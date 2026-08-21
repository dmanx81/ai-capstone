import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlsplit

import requests
from fastapi import HTTPException, status

logger = logging.getLogger("billing")

DEFAULT_FREE_ALLOWANCE = 5
DEFAULT_PRO_ALLOWANCE = 1000
ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}
PLAN_LIMIT_REASON = "plan_limit_reached"
BILLING_UNAVAILABLE_REASON = "billing_unavailable"
BILLING_OWNER_UNRESOLVED_REASON = "billing_owner_unresolved"

_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class BillingServiceError(RuntimeError):
    """Raised when a trusted billing backend call cannot be completed reliably."""


def get_supabase_url() -> str:
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        return ""
    return supabase_url.rstrip("/")


def get_supabase_service_token() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _is_configured() -> bool:
    return bool(get_supabase_url() and get_supabase_service_token())


def _request(method: str, url: str, *, params: Any = None, extra_headers: Optional[dict[str, str]] = None, timeout: int = 20) -> requests.Response:
    headers = {
        "apikey": get_supabase_service_token(),
        "Authorization": f"Bearer {get_supabase_service_token()}",
        "Content-Type": "application/json",
        **(extra_headers or {}),
    }
    try:
        response = requests.request(method, url, headers=headers, params=params, timeout=timeout)
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
