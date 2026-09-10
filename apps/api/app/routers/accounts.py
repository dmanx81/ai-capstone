from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import AuthContext, get_context, require_write
from app.models import Account, Contact, uid
from app.routers import add_linked_event, as_dict, as_list, serialize_account, touch_account
from app.schemas import AccountIn, AccountUpdate, ContactIn
from app.services.billing import assert_can_create_account
from app.services.health import recompute_health
from app.services.indexing import index_account_snapshot

router = APIRouter(tags=["crm"])


@router.get("/accounts")
def list_accounts(
    q: str | None = None,
    health: str | None = None,
    lifecycle: str | None = None,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Account).filter(Account.org_id == ctx.organization.id)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(or_(Account.name.ilike(like), Account.domain.ilike(like)))
    if health:
        query = query.filter(Account.health == health)
    if lifecycle:
        query = query.filter(Account.lifecycle == lifecycle)
    rows = query.order_by(Account.name.asc()).all()
    return [serialize_account(db, row) for row in rows]


@router.post("/accounts", status_code=201)
def create_account(payload: AccountIn, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)) -> dict:
    assert_can_create_account(db, ctx.organization)
    account = Account(
        id=uid(),
        org_id=ctx.organization.id,
        name=payload.name,
        domain=payload.domain,
        industry=payload.industry,
        lifecycle=payload.lifecycle,
        owner_id=payload.owner_id or ctx.user.id,
        arr=payload.arr,
        tags=payload.tags,
        description=payload.description,
        renewal_date=payload.renewal_date,
    )
    db.add(account)
    db.flush()
    recompute_health(db, account)
    index_account_snapshot(db, account)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="note",
        title=f"Account created: {account.name}",
        body=account.description or "Account added to the workspace.",
        source_object_type="account",
        source_object_id=account.id,
    )
    db.commit()
    db.refresh(account)
    return serialize_account(db, account)


def _account(db: Session, ctx: AuthContext, account_id: str) -> Account:
    account = db.query(Account).filter(Account.id == account_id, Account.org_id == ctx.organization.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/accounts/{account_id}")
def get_account(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> dict:
    from app.models import AccountBrief, Commitment, Opportunity, Risk, Task, TimelineEvent

    account = _account(db, ctx, account_id)
    recompute_health(db, account)
    contacts = db.query(Contact).filter(Contact.account_id == account.id, Contact.org_id == ctx.organization.id).all()
    risks = db.query(Risk).filter(Risk.account_id == account.id, Risk.org_id == ctx.organization.id).all()
    opps = db.query(Opportunity).filter(Opportunity.account_id == account.id, Opportunity.org_id == ctx.organization.id).all()
    commits = db.query(Commitment).filter(Commitment.account_id == account.id, Commitment.org_id == ctx.organization.id).all()
    tasks = db.query(Task).filter(Task.account_id == account.id, Task.org_id == ctx.organization.id).all()
    events = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.account_id == account.id, TimelineEvent.org_id == ctx.organization.id)
        .order_by(TimelineEvent.occurred_at.desc())
        .limit(25)
        .all()
    )
    brief = (
        db.query(AccountBrief)
        .filter(AccountBrief.account_id == account.id, AccountBrief.org_id == ctx.organization.id)
        .order_by(AccountBrief.created_at.desc())
        .first()
    )
    db.commit()
    return {
        "account": serialize_account(db, account),
        "contacts": as_list(contacts),
        "risks": as_list(risks),
        "opportunities": as_list(opps),
        "commitments": as_list(commits),
        "tasks": as_list(tasks),
        "recent_activity": as_list(events),
        "latest_brief": brief.content if brief else None,
        "latest_brief_at": brief.created_at if brief else None,
    }


@router.patch("/accounts/{account_id}")
def update_account(
    account_id: str, payload: AccountUpdate, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)
) -> dict:
    account = _account(db, ctx, account_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(account, key, value)
    touch_account(db, account)
    db.commit()
    db.refresh(account)
    return serialize_account(db, account)


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: str, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)) -> None:
    if ctx.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only admins can delete accounts")
    account = _account(db, ctx, account_id)
    db.delete(account)
    db.commit()


@router.get("/accounts/{account_id}/contacts")
def list_contacts(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    return as_list(
        db.query(Contact).filter(Contact.account_id == account_id, Contact.org_id == ctx.organization.id).all()
    )


@router.post("/accounts/{account_id}/contacts", status_code=201)
def create_contact(
    account_id: str, payload: ContactIn, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)
):
    account = _account(db, ctx, account_id)
    contact = Contact(id=uid(), org_id=ctx.organization.id, account_id=account.id, **payload.model_dump())
    db.add(contact)
    db.flush()
    index_account_snapshot(db, account)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="note",
        title=f"Contact added: {contact.name}",
        body=f"{contact.title or 'Stakeholder'} · {contact.stakeholder_role}",
        source_object_type="contact",
        source_object_id=contact.id,
    )
    db.commit()
    db.refresh(contact)
    return as_dict(contact)


@router.patch("/contacts/{contact_id}")
def update_contact(
    contact_id: str, payload: ContactIn, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)
):
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.org_id == ctx.organization.id).one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in payload.model_dump().items():
        setattr(contact, key, value)
    account = _account(db, ctx, contact.account_id)
    index_account_snapshot(db, account)
    db.commit()
    db.refresh(contact)
    return as_dict(contact)


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: str, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)) -> None:
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.org_id == ctx.organization.id).one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
