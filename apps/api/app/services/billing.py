from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import PLANS, get_settings
from app.models import Account, Organization

settings = get_settings()


def current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def reset_usage_if_needed(org: Organization) -> None:
    month = current_month()
    if org.ai_usage_month != month:
        org.ai_usage_month = month
        org.ai_actions_used = 0


def plan_limits(org: Organization) -> dict:
    return PLANS.get(org.plan, PLANS["free"])


def assert_can_create_account(db: Session, org: Organization) -> None:
    limits = plan_limits(org)
    max_accounts = limits["max_accounts"]
    if max_accounts is None:
        return
    count = db.query(Account).filter(Account.org_id == org.id).count()
    if count >= int(max_accounts):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"{org.plan} plan allows {max_accounts} accounts. Upgrade to add more.",
        )


def assert_can_run_ai(org: Organization) -> None:
    reset_usage_if_needed(org)
    limits = plan_limits(org)
    cap = limits["ai_actions_monthly"]
    if cap is not None and org.ai_actions_used >= int(cap):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Monthly AI action limit reached for this plan.",
        )


def consume_ai(org: Organization) -> None:
    reset_usage_if_needed(org)
    org.ai_actions_used += 1


def billing_view(org: Organization) -> dict:
    reset_usage_if_needed(org)
    limits = plan_limits(org)
    return {
        "plan": org.plan,
        "plan_status": org.plan_status,
        "stripe_enabled": settings.stripe_enabled,
        "current_period_end": org.current_period_end.isoformat() if org.current_period_end else None,
        "ai_actions_used": org.ai_actions_used,
        "ai_actions_limit": limits["ai_actions_monthly"],
        "max_accounts": limits["max_accounts"],
        "documents_enabled": limits["docs"],
    }
