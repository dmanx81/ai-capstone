from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import AuthContext, get_context
from app.models import Account, AccountBrief, Commitment, Opportunity, Risk, Task, TimelineEvent
from app.routers import serialize_account
from app.services.health import _aware, recompute_health

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> dict:
    org_id = ctx.organization.id
    now = datetime.now(timezone.utc)
    accounts = db.query(Account).filter(Account.org_id == org_id).all()
    for account in accounts:
        recompute_health(db, account)
    db.commit()

    def dump(account: Account) -> dict:
        return serialize_account(db, account)

    health_dist = {"healthy": 0, "watch": 0, "at_risk": 0, "critical": 0}
    for account in accounts:
        health_dist[account.health] = health_dist.get(account.health, 0) + 1

    attention = sorted(
        [a for a in accounts if a.health in {"at_risk", "critical"} or a.lifecycle in {"churn_risk", "renewal"}],
        key=lambda a: a.health_score,
    )[:8]
    high_risk = sorted([a for a in accounts if a.health in {"at_risk", "critical"}], key=lambda a: a.health_score)[:8]

    opps = (
        db.query(Opportunity)
        .filter(Opportunity.org_id == org_id, Opportunity.status.in_(["identified", "qualifying", "pursuing"]))
        .all()
    )
    commits = db.query(Commitment).filter(Commitment.org_id == org_id, Commitment.status.in_(["open", "in_progress"])).all()
    overdue = [c for c in commits if c.due_date and _aware(c.due_date) < now]
    tasks = db.query(Task).filter(Task.org_id == org_id, Task.status.in_(["open", "in_progress"])).all()
    upcoming_tasks = [t for t in tasks if t.due_date and now <= _aware(t.due_date) <= now + timedelta(days=14)]
    upcoming_renewals = [a for a in accounts if a.renewal_date and now <= _aware(a.renewal_date) <= now + timedelta(days=45)]

    briefs = (
        db.query(AccountBrief)
        .filter(AccountBrief.org_id == org_id)
        .order_by(AccountBrief.created_at.desc())
        .limit(6)
        .all()
    )
    names = {a.id: a.name for a in accounts}
    recent = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.org_id == org_id)
        .order_by(TimelineEvent.occurred_at.desc())
        .limit(12)
        .all()
    )

    total_arr = sum(float(a.arr or 0) for a in accounts)
    return {
        "summary": {
            "accounts": len(accounts),
            "arr": total_arr,
            "at_risk": health_dist.get("at_risk", 0) + health_dist.get("critical", 0),
            "open_opportunities": len(opps),
            "overdue_commitments": len(overdue),
            "open_tasks": len(tasks),
        },
        "health_distribution": health_dist,
        "attention": [dump(a) for a in attention],
        "high_risk": [dump(a) for a in high_risk],
        "opportunities": [
            {
                "id": o.id,
                "account_id": o.account_id,
                "account_name": names.get(o.account_id),
                "title": o.title,
                "potential_value": float(o.potential_value) if o.potential_value is not None else None,
                "status": o.status,
                "confidence": o.confidence,
            }
            for o in opps
        ],
        "overdue_commitments": [
            {
                "id": c.id,
                "account_id": c.account_id,
                "account_name": names.get(c.account_id),
                "description": c.description,
                "due_date": c.due_date,
                "direction": c.direction,
            }
            for c in overdue
        ],
        "upcoming": {
            "tasks": [
                {
                    "id": t.id,
                    "account_id": t.account_id,
                    "account_name": names.get(t.account_id),
                    "title": t.title,
                    "due_date": t.due_date,
                }
                for t in sorted(upcoming_tasks, key=lambda t: _aware(t.due_date))
            ],
            "renewals": [dump(a) for a in sorted(upcoming_renewals, key=lambda a: _aware(a.renewal_date))],
        },
        "recent_intelligence": [
            {
                "id": b.id,
                "account_id": b.account_id,
                "account_name": names.get(b.account_id),
                "created_at": b.created_at,
                "summary": (b.content or {}).get("executive_summary"),
            }
            for b in briefs
        ],
        "recent_activity": [
            {
                "id": e.id,
                "account_id": e.account_id,
                "account_name": names.get(e.account_id),
                "event_type": e.event_type,
                "title": e.title,
                "occurred_at": e.occurred_at,
            }
            for e in recent
        ],
        "focus": _focus_line(health_dist, overdue, attention),
        "today": _today_queue(
            accounts=accounts,
            overdue=overdue,
            names=names,
            tasks=tasks,
            opps=opps,
            recent=recent,
            now=now,
            db=db,
            org_id=org_id,
        ),
    }


def _focus_line(health_dist: dict, overdue: list, attention: list[Account]) -> str:
    if attention:
        top = attention[0]
        return f"Start with {top.name} — health {top.health.replace('_', ' ')} ({top.health_score}/100)."
    if overdue:
        return f"{len(overdue)} commitments are overdue. Close or renegotiate them today."
    if health_dist.get("watch"):
        return "No critical accounts. Review watch-status customers before they drift."
    return "Portfolio looks stable. Use the time to advance open opportunities."


def _today_queue(
    *,
    accounts: list[Account],
    overdue: list[Commitment],
    names: dict[str, str],
    tasks: list[Task],
    opps: list[Opportunity],
    recent: list[TimelineEvent],
    now: datetime,
    db: Session,
    org_id: str,
) -> list[dict]:
    items: list[dict] = []
    for account in sorted(
        [a for a in accounts if a.health in {"at_risk", "critical"} or a.lifecycle in {"churn_risk", "renewal"}],
        key=lambda a: a.health_score,
    )[:4]:
        items.append(
            {
                "kind": "account",
                "urgency": "high" if account.health in {"at_risk", "critical"} else "medium",
                "title": f"Review {account.name}",
                "detail": f"Health {account.health.replace('_', ' ')} ({account.health_score}/100)",
                "account_id": account.id,
                "account_name": account.name,
            }
        )
    for commit in overdue[:4]:
        items.append(
            {
                "kind": "commitment",
                "urgency": "high",
                "title": commit.description,
                "detail": f"Overdue · {names.get(commit.account_id)} · {commit.direction}",
                "account_id": commit.account_id,
                "account_name": names.get(commit.account_id),
            }
        )
    risks = (
        db.query(Risk)
        .filter(Risk.org_id == org_id, Risk.status.in_(["open", "monitoring"]), Risk.severity.in_(["high", "critical"]))
        .all()
    )
    for risk in risks[:4]:
        items.append(
            {
                "kind": "risk",
                "urgency": "high" if risk.severity == "critical" else "medium",
                "title": risk.title,
                "detail": f"{risk.severity} risk · {names.get(risk.account_id)}",
                "account_id": risk.account_id,
                "account_name": names.get(risk.account_id),
            }
        )
    upcoming = [
        t for t in tasks if t.due_date and now <= _aware(t.due_date) <= now + timedelta(days=7)
    ]
    for task in sorted(upcoming, key=lambda t: _aware(t.due_date))[:4]:
        items.append(
            {
                "kind": "task",
                "urgency": "medium",
                "title": task.title,
                "detail": f"Due soon · {names.get(task.account_id)}",
                "account_id": task.account_id,
                "account_name": names.get(task.account_id),
            }
        )
    expansions = sorted(
        [o for o in opps if (o.confidence or 0) >= 0.5],
        key=lambda o: float(o.potential_value or 0),
        reverse=True,
    )
    for opp in expansions[:3]:
        items.append(
            {
                "kind": "opportunity",
                "urgency": "low",
                "title": opp.title,
                "detail": f"Expansion · {names.get(opp.account_id)}",
                "account_id": opp.account_id,
                "account_name": names.get(opp.account_id),
            }
        )
    week = now - timedelta(days=7)
    for event in [e for e in recent if _aware(e.occurred_at) >= week][:4]:
        items.append(
            {
                "kind": "change",
                "urgency": "low",
                "title": event.title,
                "detail": f"{event.event_type.replace('_', ' ')} · {names.get(event.account_id)}",
                "account_id": event.account_id,
                "account_name": names.get(event.account_id),
            }
        )
    rank = {"high": 0, "medium": 1, "low": 2}
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for item in sorted(items, key=lambda row: rank.get(row["urgency"], 9)):
        key = (item["kind"], item["title"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique[:10]
