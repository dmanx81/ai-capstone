from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import AuthContext, get_context
from app.models import Account, TimelineEvent, uid
from app.routers import as_dict, as_list
from app.schemas import TimelineIn, TimelineUpdate
from app.services.health import recompute_health
from app.services.indexing import index_timeline

router = APIRouter(tags=["timeline"])

EDITABLE = {"meeting", "email", "call", "note", "customer_request", "product_issue", "renewal_event"}


def _account(db: Session, ctx: AuthContext, account_id: str) -> Account:
    account = db.query(Account).filter(Account.id == account_id, Account.org_id == ctx.organization.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/accounts/{account_id}/timeline")
def list_timeline(
    account_id: str,
    q: str | None = None,
    event_type: str | None = Query(default=None),
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_db),
):
    _account(db, ctx, account_id)
    query = db.query(TimelineEvent).filter(
        TimelineEvent.account_id == account_id, TimelineEvent.org_id == ctx.organization.id
    )
    if event_type:
        types = [item.strip() for item in event_type.split(",") if item.strip()]
        query = query.filter(TimelineEvent.event_type.in_(types))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(TimelineEvent.title.ilike(like), TimelineEvent.body.ilike(like)))
    return as_list(query.order_by(TimelineEvent.occurred_at.desc()).all())


@router.post("/accounts/{account_id}/timeline", status_code=201)
def create_event(
    account_id: str, payload: TimelineIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    account = _account(db, ctx, account_id)
    event = TimelineEvent(
        id=uid(),
        org_id=ctx.organization.id,
        account_id=account.id,
        event_type=payload.event_type,
        title=payload.title,
        body=payload.body,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
        created_by=ctx.user.id,
        contact_ids=payload.contact_ids,
        evidence_source=payload.evidence_source,
        evidence_url=payload.evidence_url,
        evidence_excerpt=payload.evidence_excerpt,
    )
    db.add(event)
    db.flush()
    index_timeline(db, event)
    recompute_health(db, account)
    db.commit()
    db.refresh(event)
    return as_dict(event)


@router.patch("/timeline/{event_id}")
def update_event(
    event_id: str, payload: TimelineUpdate, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    event = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.id == event_id, TimelineEvent.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    if event.event_type not in EDITABLE:
        raise HTTPException(status_code=400, detail="This entry is managed from its source record")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(event, key, value)
    index_timeline(db, event)
    account = _account(db, ctx, event.account_id)
    recompute_health(db, account)
    db.commit()
    db.refresh(event)
    return as_dict(event)


@router.delete("/timeline/{event_id}", status_code=204)
def delete_event(event_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)) -> None:
    event = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.id == event_id, TimelineEvent.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Timeline entry not found")
    if event.event_type not in EDITABLE:
        raise HTTPException(status_code=400, detail="This entry is managed from its source record")
    db.delete(event)
    db.commit()
