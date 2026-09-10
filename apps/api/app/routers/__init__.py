from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models import Account, Contact, Risk, TimelineEvent, User, uid
from app.services.health import recompute_health
from app.services.indexing import index_timeline


def as_dict(obj: object) -> dict[str, Any]:
    if obj is None:
        return {}
    if hasattr(obj, "__table__"):
        data: dict[str, Any] = {}
        for column in obj.__table__.columns:  # type: ignore[attr-defined]
            value = getattr(obj, column.name)
            if hasattr(value, "isoformat"):
                data[column.name] = value.isoformat()
            elif hasattr(value, "__float__") and column.name in {"arr", "potential_value"}:
                data[column.name] = float(value) if value is not None else None
            else:
                data[column.name] = value
        data.pop("password_hash", None)
        return data
    encoded = jsonable_encoder(obj)
    if isinstance(encoded, dict):
        encoded.pop("password_hash", None)
        return encoded
    return {"value": encoded}


def as_list(rows: list[object]) -> list[dict[str, Any]]:
    return [as_dict(row) for row in rows]


def serialize_account(db: Session, account: Account) -> dict:
    owner = db.get(User, account.owner_id) if account.owner_id else None
    contact_count = db.query(Contact).filter(Contact.account_id == account.id, Contact.org_id == account.org_id).count()
    open_risks = (
        db.query(Risk)
        .filter(Risk.account_id == account.id, Risk.org_id == account.org_id, Risk.status.in_(["open", "monitoring"]))
        .count()
    )
    return {
        "id": account.id,
        "org_id": account.org_id,
        "name": account.name,
        "domain": account.domain,
        "industry": account.industry,
        "lifecycle": account.lifecycle,
        "owner_id": account.owner_id,
        "health": account.health,
        "health_score": account.health_score,
        "arr": float(account.arr) if account.arr is not None else None,
        "tags": account.tags or [],
        "description": account.description,
        "renewal_date": account.renewal_date,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
        "owner_name": owner.full_name if owner else None,
        "contact_count": contact_count,
        "open_risk_count": open_risks,
    }


def add_linked_event(
    db: Session,
    *,
    org_id: str,
    account_id: str,
    user_id: str,
    event_type: str,
    title: str,
    body: str,
    source_object_type: str,
    source_object_id: str,
) -> TimelineEvent:
    event = TimelineEvent(
        id=uid(),
        org_id=org_id,
        account_id=account_id,
        event_type=event_type,
        title=title,
        body=body,
        occurred_at=datetime.now(timezone.utc),
        created_by=user_id,
        source_object_type=source_object_type,
        source_object_id=source_object_id,
    )
    db.add(event)
    db.flush()
    index_timeline(db, event)
    return event


def touch_account(db: Session, account: Account) -> None:
    recompute_health(db, account)
    from app.services.indexing import index_account_snapshot

    index_account_snapshot(db, account)
