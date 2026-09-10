from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import AuthContext, get_context
from app.models import Organization
from app.schemas import CheckoutIn
from app.services.billing import billing_view

router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()


@router.get("/status")
def status(ctx: AuthContext = Depends(get_context)) -> dict:
    return billing_view(ctx.organization)


@router.post("/checkout")
def checkout(payload: CheckoutIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> dict:
    if ctx.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only owners and admins can change billing")
    if not settings.stripe_enabled:
        return {
            "demo": True,
            "message": "Stripe keys are not configured. Use demo activate to simulate an upgrade.",
            "plan": payload.plan,
        }
    import stripe

    stripe.api_key = settings.stripe_secret_key
    price = settings.stripe_price_starter if payload.plan == "starter" else settings.stripe_price_growth
    if not price:
        raise HTTPException(status_code=500, detail="Stripe price IDs are not configured")
    customer = ctx.organization.stripe_customer_id
    if not customer:
        created = stripe.Customer.create(
            email=ctx.user.email, name=ctx.organization.name, metadata={"org_id": ctx.organization.id}
        )
        customer = created.id
        ctx.organization.stripe_customer_id = customer
        db.commit()
    session = stripe.checkout.Session.create(
        customer=customer,
        mode="subscription",
        line_items=[{"price": price, "quantity": 1}],
        success_url=settings.stripe_success_url,
        cancel_url=settings.stripe_cancel_url,
        metadata={"org_id": ctx.organization.id, "plan": payload.plan},
    )
    return {"demo": False, "checkout_url": session.url}


@router.post("/demo-activate")
def demo_activate(payload: CheckoutIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> dict:
    if ctx.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only owners and admins can change billing")
    if settings.stripe_enabled:
        raise HTTPException(status_code=400, detail="Stripe is configured — use Checkout instead of demo activate")
    ctx.organization.plan = payload.plan
    ctx.organization.plan_status = "active"
    ctx.organization.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
    db.commit()
    return billing_view(ctx.organization)


@router.post("/portal")
def portal(ctx: AuthContext = Depends(get_context)) -> dict:
    if not settings.stripe_enabled or not ctx.organization.stripe_customer_id:
        return {"demo": True, "url": None}
    import stripe

    stripe.api_key = settings.stripe_secret_key
    session = stripe.billing_portal.Session.create(
        customer=ctx.organization.stripe_customer_id,
        return_url=settings.stripe_success_url,
    )
    return {"demo": False, "url": session.url}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.stripe_enabled:
        return {"ignored": True}
    import stripe

    stripe.api_key = settings.stripe_secret_key
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid Stripe signature") from exc

    obj = event["data"]["object"]
    if event["type"] in {"checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"}:
        org_id = (obj.get("metadata") or {}).get("org_id")
        customer = obj.get("customer")
        org = None
        if org_id:
            org = db.get(Organization, org_id)
        if org is None and customer:
            org = db.query(Organization).filter(Organization.stripe_customer_id == customer).one_or_none()
        if org:
            plan = (obj.get("metadata") or {}).get("plan") or org.plan
            org.plan = plan
            org.plan_status = obj.get("status") or "active"
            org.stripe_subscription_id = obj.get("subscription") or obj.get("id")
            org.stripe_customer_id = org.stripe_customer_id or customer
            db.commit()
    elif event["type"] in {"customer.subscription.deleted"}:
        customer = obj.get("customer")
        org = db.query(Organization).filter(Organization.stripe_customer_id == customer).one_or_none()
        if org:
            org.plan = "free"
            org.plan_status = "canceled"
            db.commit()
    return {"received": True}
