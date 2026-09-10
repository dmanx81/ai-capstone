from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Account, Commitment, Risk, TimelineEvent

OPEN_RISK = {"open", "monitoring"}
OPEN_COMMIT = {"open", "in_progress"}
SEVERITY_PENALTY = {"critical": 18, "high": 12, "medium": 6, "low": 2}


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def recompute_health(db: Session, account: Account) -> Account:
    now = datetime.now(timezone.utc)
    score = 78
    last = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.account_id == account.id, TimelineEvent.org_id == account.org_id)
        .order_by(TimelineEvent.occurred_at.desc())
        .first()
    )
    if last:
        age = now - _aware(last.occurred_at)
        if age > timedelta(days=45):
            score -= 18
        elif age > timedelta(days=21):
            score -= 10
        elif age > timedelta(days=14):
            score -= 4
    else:
        score -= 12

    risks = (
        db.query(Risk)
        .filter(Risk.account_id == account.id, Risk.org_id == account.org_id, Risk.status.in_(OPEN_RISK))
        .all()
    )
    for risk in risks:
        score -= SEVERITY_PENALTY.get(risk.severity, 4)

    commits = (
        db.query(Commitment)
        .filter(
            Commitment.account_id == account.id,
            Commitment.org_id == account.org_id,
            Commitment.status.in_(OPEN_COMMIT),
        )
        .all()
    )
    for item in commits:
        if item.due_date and _aware(item.due_date) < now:
            score -= 8

    if account.lifecycle == "churn_risk":
        score -= 10
    elif account.lifecycle == "churned":
        score = min(score, 20)
    elif account.lifecycle == "onboarding":
        score -= 4

    score = max(0, min(100, score))
    if score >= 75:
        label = "healthy"
    elif score >= 55:
        label = "watch"
    elif score >= 35:
        label = "at_risk"
    else:
        label = "critical"
    account.health_score = score
    account.health = label
    return account
