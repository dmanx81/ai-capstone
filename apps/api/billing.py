import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlsplit

import requests
import stripe
from fastapi import HTTPException, status

logger = logging.getLogger("billing")

DEFAULT_FREE_ALLOWANCE = 5
DEFAULT_PRO_ALLOWANCE = 1000
ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}
# Must match the 008_billing.sql check constraint exactly -- any Stripe status
# outside this set (incomplete, incomplete_expired, paused, ...) is normalized
# to "inactive" before being written, rather than widening the constraint.
ALLOWED_BILLING_STATUSES = {"inactive", "active", "trialing", "past_due", "canceled", "unpaid"}
PLAN_LIMIT_REASON = "plan_limit_reached"
BILLING_UNAVAILABLE_REASON = "billing_unavailable"
BILLING_OWNER_UNRESOLVED_REASON = "billing_owner_unresolved"

_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class BillingServiceError(RuntimeError):
    """Raised when a trusted billing backend call cannot be completed reliably."""


class NoStripeCustomerError(BillingServiceError):
    """Raised when a Billing Portal session is requested but no Stripe customer exists yet."""


class StripeWebhookNotConfiguredError(BillingServiceError):
    """Raised when STRIPE_WEBHOOK_SECRET is missing -- webhook must fail safe, never skip verification."""


class StripeNotConfiguredError(BillingServiceError):
    """Raised when STRIPE_SECRET_KEY or a required Stripe config value is missing."""


def get_supabase_url() -> str:
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        return ""
    return supabase_url.rstrip("/")


def get_supabase_service_token() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _is_configured() -> bool:
    return bool(get_supabase_url() and get_supabase_service_token())


def _request(
    method: str,
    url: str,
    *,
    params: Any = None,
    json_body: Any = None,
    extra_headers: Optional[dict[str, str]] = None,
    timeout: int = 20,
) -> requests.Response:
    headers = {
        "apikey": get_supabase_service_token(),
        "Authorization": f"Bearer {get_supabase_service_token()}",
        "Content-Type": "application/json",
        **(extra_headers or {}),
    }
    try:
        response = requests.request(method, url, headers=headers, params=params, json=json_body, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.RequestException as error:
        status_code = getattr(getattr(error, "response", None), "status_code", None)
        logger.error(
            "billing_backend_request_failed",
            extra={"method": method, "path": urlsplit(url).path, "status_code": status_code},
        )
        raise BillingServiceError("Trusted billing backend request failed") from error


def _calendar_month_period_utc(now: Optional[datetime] = None) -> tuple[str, str]:
    reference = now or datetime.now(timezone.utc)
    period_start = datetime(reference.year, reference.month, 1, tzinfo=timezone.utc)
    if reference.month == 12:
        period_end = datetime(reference.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        period_end = datetime(reference.year, reference.month + 1, 1, tzinfo=timezone.utc)
    return period_start.isoformat(), period_end.isoformat()


def _effective_plan_and_active(row: dict[str, Any]) -> tuple[str, str, bool]:
    plan = str(row.get("plan", "FREE")).upper()
    if plan not in {"FREE", "PRO"}:
        plan = "FREE"
    sub_status = str(row.get("status", "inactive")).lower() or "inactive"
    is_active = plan == "PRO" and sub_status in ACTIVE_SUBSCRIPTION_STATUSES
    # An inactive/canceled PRO subscription falls back to FREE entitlement
    # rather than blocking analysis outright.
    effective_plan = "PRO" if is_active else "FREE"
    return effective_plan, sub_status, is_active


def _resolve_billing_period(row: dict[str, Any], effective_plan: str, is_active: bool) -> tuple[str, str]:
    if effective_plan == "PRO" and is_active:
        period_start = row.get("current_period_start")
        period_end = row.get("current_period_end")
        if period_start and period_end:
            return str(period_start), str(period_end)
    return _calendar_month_period_utc()


def _default_entitlement() -> dict[str, Any]:
    period_start, period_end = _calendar_month_period_utc()
    return {
        "plan": "FREE",
        "status": "inactive",
        "monthly_analysis_allowance": DEFAULT_FREE_ALLOWANCE,
        "usage_count": 0,
        "remaining_usage": DEFAULT_FREE_ALLOWANCE,
        "is_active": False,
        "can_analyze": True,
        "period_start": period_start,
        "period_end": period_end,
    }


def get_user_billing_row(user_id: str) -> Optional[dict[str, Any]]:
    if not user_id or not _is_configured():
        return None
    response = _request(
        "GET",
        f"{get_supabase_url()}/rest/v1/user_billing",
        params={
            "user_id": f"eq.{user_id}",
            "select": "user_id,plan,status,monthly_analysis_allowance,stripe_customer_id,stripe_subscription_id,stripe_price_id,current_period_start,current_period_end,updated_at",
        },
    )
    rows = response.json() or []
    return rows[0] if rows else None


def get_account_owner_id(account_id: str) -> Optional[str]:
    if not account_id or not _is_configured():
        return None
    response = _request(
        "GET",
        f"{get_supabase_url()}/rest/v1/accounts",
        params={"id": f"eq.{account_id}", "select": "owner_id"},
    )
    rows = response.json() or []
    if not rows:
        return None
    return rows[0].get("owner_id")


def get_account_ids_for_owner(owner_id: str) -> list[str]:
    if not owner_id or not _is_configured():
        return []
    response = _request(
        "GET",
        f"{get_supabase_url()}/rest/v1/accounts",
        params={"owner_id": f"eq.{owner_id}", "select": "id"},
    )
    rows = response.json() or []
    return [str(row["id"]) for row in rows if row.get("id")]


def count_completed_interactions_for_accounts(account_ids: list[str], period_start: str, period_end: str) -> int:
    # interactions.analysis_status only reaches 'complete' (worker.py
    # process_job) after persist_brief_and_items fully succeeds -- brief AND
    # extracted_items. A brief row can exist for an interaction whose job still
    # ended 'failed' (e.g. extracted_items insert fails after the brief POST
    # already committed), so counting briefs directly would overcount. interactions.id
    # is the primary key -- one row per interaction, updated in place -- so a
    # retried interaction can only ever be counted once, however many times it
    # was retried.
    valid_ids = [account_id for account_id in account_ids if _UUID_RE.match(account_id)]
    if not valid_ids or not _is_configured():
        return 0

    response = _request(
        "GET",
        f"{get_supabase_url()}/rest/v1/interactions",
        params={
            "select": "id",
            "account_id": f"in.({','.join(valid_ids)})",
            "analysis_status": "eq.complete",
            "analysis_completed_at": [f"gte.{period_start}", f"lt.{period_end}"],
        },
        extra_headers={"Prefer": "count=exact"},
    )
    content_range = response.headers.get("Content-Range", "")
    if "/" in content_range:
        total = content_range.rsplit("/", 1)[-1]
        if total.isdigit():
            return int(total)
    rows = response.json() or []
    return len(rows)


def get_user_entitlement(user_id: str) -> dict[str, Any]:
    if not user_id:
        return _default_entitlement()

    row = get_user_billing_row(str(user_id)) or {}
    effective_plan, sub_status, is_active = _effective_plan_and_active(row)
    period_start, period_end = _resolve_billing_period(row, effective_plan, is_active)
    allowance = DEFAULT_PRO_ALLOWANCE if effective_plan == "PRO" else DEFAULT_FREE_ALLOWANCE

    account_ids = get_account_ids_for_owner(str(user_id))
    completed_count = count_completed_interactions_for_accounts(account_ids, period_start, period_end)
    remaining = max(0, allowance - completed_count)

    return {
        "plan": effective_plan,
        "status": sub_status,
        "monthly_analysis_allowance": allowance,
        "usage_count": completed_count,
        "remaining_usage": remaining,
        "is_active": is_active,
        "can_analyze": remaining > 0,
        "period_start": period_start,
        "period_end": period_end,
    }


def get_account_entitlement(account_id: str) -> dict[str, Any]:
    # Check-then-act, not atomic: this reads the current completed-count and
    # returns a decision with no lock or reservation held until the caller's
    # eventual analysis_status='complete' write. Safe under the supported beta
    # topology of exactly one worker process; see apps/api/BILLING.md before
    # running more than one worker.
    #
    # A missing/unresolved owner is NOT the same as "valid owner, no billing
    # row yet" (get_user_entitlement already returns a normal FREE entitlement
    # for that case). An unresolved owner means the trusted account_id ->
    # owner_id lookup itself failed or found nothing -- e.g. a deleted/bogus
    # account_id -- and must fail closed rather than silently granting FREE
    # usage and letting the provider be called against no verified owner.
    owner_id = get_account_owner_id(str(account_id))
    if not owner_id:
        raise BillingServiceError(BILLING_OWNER_UNRESOLVED_REASON)
    return get_user_entitlement(str(owner_id))


def enforce_analysis_allowance_for_account(account_id: str) -> dict[str, Any]:
    try:
        entitlement = get_account_entitlement(str(account_id))
    except BillingServiceError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=BILLING_UNAVAILABLE_REASON,
        ) from error

    if not entitlement["can_analyze"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=PLAN_LIMIT_REASON,
        )
    return entitlement


# ---------------------------------------------------------------------------
# Stripe (test-mode) integration. See apps/api/BILLING.md for the trust model:
# Stripe is billing authority, Supabase user_id is identity authority, and the
# customer_id -> user_billing.stripe_customer_id -> user_id chain (established
# at Checkout-session creation time) is the only trusted path from a webhook
# event back to an account -- event metadata is never used to pick a mutation
# target.
# ---------------------------------------------------------------------------


def get_stripe_secret_key() -> str:
    return os.getenv("STRIPE_SECRET_KEY", "")


def get_stripe_webhook_secret() -> str:
    return os.getenv("STRIPE_WEBHOOK_SECRET", "")


def get_stripe_pro_price_id() -> str:
    return os.getenv("STRIPE_PRO_PRICE_ID", "")


def get_stripe_success_url() -> str:
    return os.getenv("STRIPE_SUCCESS_URL", "")


def get_stripe_cancel_url() -> str:
    return os.getenv("STRIPE_CANCEL_URL", "")


def get_stripe_portal_return_url() -> str:
    return os.getenv("STRIPE_PORTAL_RETURN_URL", "")


def _configure_stripe() -> None:
    secret_key = get_stripe_secret_key()
    if not secret_key:
        raise StripeNotConfiguredError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = secret_key


def _normalize_stripe_status(raw_status: Optional[str]) -> str:
    status_value = str(raw_status or "inactive").lower()
    return status_value if status_value in ALLOWED_BILLING_STATUSES else "inactive"


def upsert_user_billing_fields(user_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    if not _is_configured():
        raise BillingServiceError("Trusted billing backend is not configured")
    payload = {"user_id": str(user_id), **fields, "updated_at": datetime.now(timezone.utc).isoformat()}
    response = _request(
        "POST",
        f"{get_supabase_url()}/rest/v1/user_billing",
        params={"on_conflict": "user_id"},
        json_body=payload,
        extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
    )
    rows = response.json() or []
    if not rows:
        raise BillingServiceError("Trusted billing write did not return a row")
    return rows[0]


def resolve_user_id_for_stripe_customer(customer_id: str) -> Optional[str]:
    if not customer_id or not _is_configured():
        return None
    response = _request(
        "GET",
        f"{get_supabase_url()}/rest/v1/user_billing",
        params={"stripe_customer_id": f"eq.{customer_id}", "select": "user_id"},
    )
    rows = response.json() or []
    if not rows:
        return None
    return rows[0].get("user_id")


def resolve_or_create_stripe_customer(user_id: str) -> str:
    row = get_user_billing_row(str(user_id))
    existing_customer_id = row.get("stripe_customer_id") if row else None
    if existing_customer_id:
        return str(existing_customer_id)

    _configure_stripe()
    try:
        customer = stripe.Customer.create(metadata={"supabase_user_id": str(user_id)})
    except stripe.error.StripeError as error:
        logger.error("stripe_customer_create_failed")
        raise BillingServiceError("Stripe customer creation failed") from error

    upsert_user_billing_fields(str(user_id), {"stripe_customer_id": customer.id})
    return str(customer.id)


def create_checkout_session(user_id: str) -> str:
    price_id = get_stripe_pro_price_id()
    success_url = get_stripe_success_url()
    cancel_url = get_stripe_cancel_url()
    if not price_id or not success_url or not cancel_url:
        raise StripeNotConfiguredError("Stripe checkout is not fully configured")

    customer_id = resolve_or_create_stripe_customer(str(user_id))

    _configure_stripe()
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"supabase_user_id": str(user_id)},
        )
    except stripe.error.StripeError as error:
        logger.error("stripe_checkout_session_create_failed")
        raise BillingServiceError("Stripe checkout session creation failed") from error

    if not session.url:
        raise BillingServiceError("Stripe checkout session did not return a URL")
    return str(session.url)


def create_portal_session(user_id: str) -> str:
    return_url = get_stripe_portal_return_url()
    if not return_url:
        raise StripeNotConfiguredError("Stripe portal return URL is not configured")

    row = get_user_billing_row(str(user_id))
    customer_id = row.get("stripe_customer_id") if row else None
    if not customer_id:
        raise NoStripeCustomerError("no_active_billing_customer")

    _configure_stripe()
    try:
        session = stripe.billing_portal.Session.create(customer=str(customer_id), return_url=return_url)
    except stripe.error.StripeError as error:
        logger.error("stripe_portal_session_create_failed")
        raise BillingServiceError("Stripe portal session creation failed") from error

    if not session.url:
        raise BillingServiceError("Stripe portal session did not return a URL")
    return str(session.url)


def verify_and_parse_stripe_event(payload: bytes, signature: Optional[str]) -> dict[str, Any]:
    webhook_secret = get_stripe_webhook_secret()
    if not webhook_secret:
        raise StripeWebhookNotConfiguredError("STRIPE_WEBHOOK_SECRET is not configured")
    if not signature:
        raise stripe.error.SignatureVerificationError("Missing Stripe-Signature header", signature)
    return stripe.Webhook.construct_event(payload, signature, webhook_secret)


def claim_stripe_webhook_event(event_id: str, event_type: str) -> dict[str, Any]:
    if not _is_configured():
        raise BillingServiceError("Trusted billing backend is not configured")
    response = _request(
        "POST",
        f"{get_supabase_url()}/rest/v1/rpc/claim_stripe_webhook_event",
        json_body={"p_stripe_event_id": str(event_id), "p_event_type": str(event_type)},
    )
    rows = response.json() or []
    if not rows:
        raise BillingServiceError("Stripe webhook claim RPC returned no result")
    row = rows[0]
    return {"claimed": bool(row.get("claimed")), "already_completed": bool(row.get("already_completed"))}


def mark_stripe_webhook_event_completed(event_id: str) -> None:
    _request(
        "PATCH",
        f"{get_supabase_url()}/rest/v1/stripe_webhook_events",
        params={"stripe_event_id": f"eq.{event_id}"},
        json_body={"status": "completed", "processed_at": datetime.now(timezone.utc).isoformat()},
    )


def mark_stripe_webhook_event_failed(event_id: str, reason: str) -> None:
    _request(
        "PATCH",
        f"{get_supabase_url()}/rest/v1/stripe_webhook_events",
        params={"stripe_event_id": f"eq.{event_id}"},
        json_body={"status": "failed", "last_error": reason},
    )


def _extract_subscription_fields(subscription: Any) -> dict[str, Any]:
    items_container = subscription.get("items") or {}
    items_data = items_container.get("data") or []
    price_id = None
    if items_data:
        price = items_data[0].get("price") or {}
        price_id = price.get("id")

    def _to_iso(unix_ts: Any) -> Optional[str]:
        if unix_ts is None:
            return None
        return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).isoformat()

    return {
        "stripe_subscription_id": subscription.get("id"),
        "stripe_customer_id": subscription.get("customer"),
        "stripe_price_id": price_id,
        "raw_status": subscription.get("status"),
        "current_period_start": _to_iso(subscription.get("current_period_start")),
        "current_period_end": _to_iso(subscription.get("current_period_end")),
    }


def apply_subscription_state(subscription: Any) -> None:
    fields = _extract_subscription_fields(subscription)
    customer_id = fields["stripe_customer_id"]
    if not customer_id:
        logger.warning("stripe_subscription_event_missing_customer")
        return

    # Trust chain: customer_id -> user_billing.stripe_customer_id -> user_id.
    # That mapping is only ever created by resolve_or_create_stripe_customer()
    # under an authenticated session, never from this event's own metadata.
    user_id = resolve_user_id_for_stripe_customer(str(customer_id))
    if not user_id:
        logger.info("stripe_subscription_event_unknown_customer")
        return

    plan = "PRO" if fields["stripe_price_id"] and fields["stripe_price_id"] == get_stripe_pro_price_id() else "FREE"
    upsert_user_billing_fields(
        str(user_id),
        {
            "stripe_customer_id": str(customer_id),
            "stripe_subscription_id": fields["stripe_subscription_id"],
            "stripe_price_id": fields["stripe_price_id"],
            "plan": plan,
            "status": _normalize_stripe_status(fields["raw_status"]),
            "current_period_start": fields["current_period_start"],
            "current_period_end": fields["current_period_end"],
        },
    )


def apply_checkout_completed(session: Any) -> None:
    subscription_id = session.get("subscription")
    if not subscription_id:
        return  # not a subscription checkout -- nothing to reconcile

    _configure_stripe()
    try:
        subscription = stripe.Subscription.retrieve(str(subscription_id))
    except stripe.error.StripeError as error:
        logger.error("stripe_subscription_retrieve_failed")
        raise BillingServiceError("Stripe subscription retrieval failed") from error

    apply_subscription_state(subscription)


def handle_stripe_webhook_event(event: dict[str, Any]) -> None:
    event_type = event.get("type")
    data_object = (event.get("data") or {}).get("object") or {}

    if event_type == "checkout.session.completed":
        apply_checkout_completed(data_object)
    elif event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        apply_subscription_state(data_object)
    # Any other event type -- including invoice.payment_failed -- is safely
    # ignored. customer.subscription.updated already carries every status
    # transition (past_due, unpaid, canceled, ...) this app acts on, so a
    # separate invoice.payment_failed handler would only duplicate that path.
