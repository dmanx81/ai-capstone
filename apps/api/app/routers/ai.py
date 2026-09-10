from pathlib import Path
from time import perf_counter

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import PLANS, get_settings
from app.database import get_db
from app.deps import AuthContext, get_context, require_write
from app.models import Account, AccountBrief, Document, uid
from app.routers import add_linked_event, as_dict
from app.schemas import AgentIn, AskIn
from app.services.agents import run_agent
from app.services.billing import assert_can_run_ai, consume_ai
from app.services.brief import answer_question, build_grounded_brief
from app.services.indexing import index_account_graph, index_document
from app.services.usage import log_ai_usage

router = APIRouter(tags=["ai"])
settings = get_settings()


def _account(db: Session, ctx: AuthContext, account_id: str) -> Account:
    account = db.query(Account).filter(Account.id == account_id, Account.org_id == ctx.organization.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/accounts/{account_id}/brief")
def generate_brief(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    account = _account(db, ctx, account_id)
    assert_can_run_ai(ctx.organization)
    started = perf_counter()
    try:
        content = build_grounded_brief(db, account)
    except Exception as exc:
        log_ai_usage(
            db,
            org_id=ctx.organization.id,
            user_id=ctx.user.id,
            action="brief",
            model=settings.llm_provider,
            success=False,
            error=str(exc),
            started_at=started,
        )
        db.commit()
        raise
    row = AccountBrief(
        id=uid(),
        org_id=ctx.organization.id,
        account_id=account.id,
        content=content,
        model=content.get("model", "grounded"),
        created_by=ctx.user.id,
    )
    db.add(row)
    consume_ai(ctx.organization)
    log_ai_usage(
        db,
        org_id=ctx.organization.id,
        user_id=ctx.user.id,
        action="brief",
        model=content.get("model", settings.llm_provider),
        started_at=started,
    )
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="ai_insight",
        title="Account brief generated",
        body=content.get("executive_summary", ""),
        source_object_type="brief",
        source_object_id=row.id,
    )
    db.commit()
    return {"id": row.id, "created_at": row.created_at, "content": content}


@router.get("/accounts/{account_id}/brief")
def latest_brief(account_id: str, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    _account(db, ctx, account_id)
    row = (
        db.query(AccountBrief)
        .filter(AccountBrief.account_id == account_id, AccountBrief.org_id == ctx.organization.id)
        .order_by(AccountBrief.created_at.desc())
        .first()
    )
    if not row:
        return {"content": None}
    return {"id": row.id, "created_at": row.created_at, "content": row.content}


@router.post("/ask")
def ask(payload: AskIn, ctx: AuthContext = Depends(get_context), db: Session = Depends(get_db)):
    if payload.account_id:
        _account(db, ctx, payload.account_id)
    assert_can_run_ai(ctx.organization)
    started = perf_counter()
    try:
        result = answer_question(db, ctx.organization.id, payload.question, payload.account_id)
    except Exception as exc:
        log_ai_usage(
            db,
            org_id=ctx.organization.id,
            user_id=ctx.user.id,
            action="ask",
            model=settings.llm_provider,
            success=False,
            error=str(exc),
            started_at=started,
        )
        db.commit()
        raise
    consume_ai(ctx.organization)
    log_ai_usage(
        db,
        org_id=ctx.organization.id,
        user_id=ctx.user.id,
        action="ask",
        model=result.get("model", settings.llm_provider),
        started_at=started,
    )
    db.commit()
    return result


@router.post("/accounts/{account_id}/agents")
def agent_action(
    account_id: str, payload: AgentIn, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)
):
    account = _account(db, ctx, account_id)
    assert_can_run_ai(ctx.organization)
    started = perf_counter()
    run = run_agent(
        db,
        account=account,
        action=payload.action,
        user_id=ctx.user.id,
        confirm=payload.confirm,
        apply_writes=payload.apply_writes,
    )
    consume_ai(ctx.organization)
    log_ai_usage(
        db,
        org_id=ctx.organization.id,
        user_id=ctx.user.id,
        action=f"agent:{payload.action}",
        model=settings.llm_provider,
        started_at=started,
    )
    db.commit()
    db.refresh(run)
    return as_dict(run)


@router.post("/accounts/{account_id}/reindex")
def reindex_account(account_id: str, ctx: AuthContext = Depends(require_write), db: Session = Depends(get_db)):
    account = _account(db, ctx, account_id)
    chunks = index_account_graph(db, account.id, ctx.organization.id, force=True)
    db.commit()
    return {"ok": True, "account_id": account.id, "chunks": chunks}


@router.post("/accounts/{account_id}/documents")
async def upload_document(
    account_id: str,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(require_write),
    db: Session = Depends(get_db),
):
    if not PLANS.get(ctx.organization.plan, PLANS["free"]).get("docs"):
        raise HTTPException(status_code=402, detail="Document upload requires Starter or Growth")
    account = _account(db, ctx, account_id)
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=400, detail="Files over 2MB are not accepted in this environment")
    dest_dir = Path(settings.upload_dir) / ctx.organization.id / account.id
    dest_dir.mkdir(parents=True, exist_ok=True)
    path = dest_dir / (file.filename or "upload")
    path.write_bytes(raw)
    name = (file.filename or "upload").lower()
    if name.endswith((".txt", ".md", ".csv", ".json")):
        text = raw.decode("utf-8", errors="ignore")
    else:
        text = (
            f"Uploaded binary file {file.filename} ({file.content_type}). "
            "Text extraction is limited to txt/md/csv/json locally."
        )
    doc = Document(
        id=uid(),
        org_id=ctx.organization.id,
        account_id=account.id,
        filename=file.filename or "upload",
        mime_type=file.content_type,
        storage_path=str(path),
        extracted_text=text,
        created_by=ctx.user.id,
    )
    db.add(doc)
    db.flush()
    index_document(db, doc)
    add_linked_event(
        db,
        org_id=ctx.organization.id,
        account_id=account.id,
        user_id=ctx.user.id,
        event_type="document",
        title=f"Uploaded {doc.filename}",
        body=text[:400],
        source_object_type="document",
        source_object_id=doc.id,
    )
    db.commit()
    return {"id": doc.id, "filename": doc.filename}
