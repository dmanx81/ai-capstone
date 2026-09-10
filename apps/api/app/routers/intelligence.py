from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import AuthContext, get_context
from app.models import Account, Commitment, Opportunity, Risk, Task, uid
from app.routers import add_linked_event, as_dict, as_list
from app.schemas import CommitmentIn, OpportunityIn, RiskIn, TaskIn
from app.services.health import recompute_health
from app.services.indexing import index_commitment, index_opportunity, index_risk, index_task

router = APIRouter(tags=["intelligence"])


def _account(db: Session, ctx: AuthContext, account_id: str) -> Account:
    account = db.query(Account).filter(Account.id == account_id, Account.org_id == ctx.organization.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def _dump(model: object) -> dict:
    data = model.model_dump()  # type: ignore[attr-defined]
    if "evidence" in data:
        data["evidence"] = [item.model_dump() if hasattr(item, "model_dump") else item for item in data["evidence"]]
    return data


@router.get("/accounts/{account_id}/risks")
def list_risks(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    return as_list(db.query(Risk).filter(Risk.account_id == account_id, Risk.org_id == ctx.organization.id).all())


@router.post("/accounts/{account_id}/risks", status_code=201)
def create_risk(account_id: str, payload: RiskIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    account = _account(db, ctx, account_id)
    risk = Risk(id=uid(), org_id=ctx.organization.id, account_id=account.id, **_dump(payload))
    db.add(risk)
    db.flush()
    index_risk(db, risk)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="risk",
        title=risk.title,
        body=risk.description,
        source_object_type="risk",
        source_object_id=risk.id,
    )
    recompute_health(db, account)
    db.commit()
    db.refresh(risk)
    return as_dict(risk)


@router.patch("/risks/{risk_id}")
def update_risk(risk_id: str, payload: RiskIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    risk = db.query(Risk).filter(Risk.id == risk_id, Risk.org_id == ctx.organization.id).one_or_none()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    for key, value in _dump(payload).items():
        setattr(risk, key, value)
    index_risk(db, risk)
    account = _account(db, ctx, risk.account_id)
    recompute_health(db, account)
    db.commit()
    db.refresh(risk)
    return as_dict(risk)


@router.get("/accounts/{account_id}/opportunities")
def list_opps(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    return as_list(db.query(Opportunity).filter(Opportunity.account_id == account_id, Opportunity.org_id == ctx.organization.id).all())


@router.post("/accounts/{account_id}/opportunities", status_code=201)
def create_opp(
    account_id: str, payload: OpportunityIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    account = _account(db, ctx, account_id)
    opp = Opportunity(id=uid(), org_id=ctx.organization.id, account_id=account.id, **_dump(payload))
    db.add(opp)
    db.flush()
    index_opportunity(db, opp)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="opportunity",
        title=opp.title,
        body=opp.description,
        source_object_type="opportunity",
        source_object_id=opp.id,
    )
    db.commit()
    db.refresh(opp)
    return as_dict(opp)


@router.patch("/opportunities/{opportunity_id}")
def update_opp(
    opportunity_id: str, payload: OpportunityIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    opp = (
        db.query(Opportunity)
        .filter(Opportunity.id == opportunity_id, Opportunity.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    for key, value in _dump(payload).items():
        setattr(opp, key, value)
    index_opportunity(db, opp)
    db.commit()
    db.refresh(opp)
    return as_dict(opp)


@router.get("/accounts/{account_id}/commitments")
def list_commits(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    return as_list(db.query(Commitment).filter(Commitment.account_id == account_id, Commitment.org_id == ctx.organization.id).all())


@router.post("/accounts/{account_id}/commitments", status_code=201)
def create_commit(
    account_id: str, payload: CommitmentIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    account = _account(db, ctx, account_id)
    item = Commitment(id=uid(), org_id=ctx.organization.id, account_id=account.id, **_dump(payload))
    db.add(item)
    db.flush()
    index_commitment(db, item)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="commitment",
        title=item.description[:120],
        body=f"{item.direction} · {item.status}",
        source_object_type="commitment",
        source_object_id=item.id,
    )
    recompute_health(db, account)
    db.commit()
    db.refresh(item)
    return as_dict(item)


@router.patch("/commitments/{commitment_id}")
def update_commit(
    commitment_id: str, payload: CommitmentIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)
):
    item = (
        db.query(Commitment)
        .filter(Commitment.id == commitment_id, Commitment.org_id == ctx.organization.id)
        .one_or_none()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Commitment not found")
    for key, value in _dump(payload).items():
        setattr(item, key, value)
    index_commitment(db, item)
    account = _account(db, ctx, item.account_id)
    recompute_health(db, account)
    db.commit()
    db.refresh(item)
    return as_dict(item)


@router.get("/tasks")
def list_all_tasks(ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.org_id == ctx.organization.id).order_by(Task.due_date.asc()).all()
    accounts = {a.id: a.name for a in db.query(Account).filter(Account.org_id == ctx.organization.id)}
    out = []
    for task in tasks:
        row = {c.name: getattr(task, c.name) for c in task.__table__.columns}
        row["account_name"] = accounts.get(task.account_id)
        if row.get("arr"):
            pass
        out.append(row)
    return out


@router.get("/accounts/{account_id}/tasks")
def list_tasks(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    return as_list(db.query(Task).filter(Task.account_id == account_id, Task.org_id == ctx.organization.id).all())


@router.post("/accounts/{account_id}/tasks", status_code=201)
def create_task(account_id: str, payload: TaskIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    account = _account(db, ctx, account_id)
    task = Task(id=uid(), org_id=ctx.organization.id, account_id=account.id, source="user", **payload.model_dump())
    db.add(task)
    db.flush()
    index_task(db, task)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="task",
        title=task.title,
        body=task.description or task.rationale or "",
        source_object_type="task",
        source_object_id=task.id,
    )
    db.commit()
    db.refresh(task)
    return as_dict(task)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, payload: TaskIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == ctx.organization.id).one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump().items():
        setattr(task, key, value)
    index_task(db, task)
    db.commit()
    db.refresh(task)
    return as_dict(task)
