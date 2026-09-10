from __future__ import annotations

from sqlalchemy.orm import Session

from app.ai.embeddings import get_embedder
from app.models import Account, Chunk, Contact, TimelineEvent, uid
from app.models import Commitment, Document, Opportunity, Risk, Task


def chunk_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    clean = " ".join((text or "").split())
    if not clean:
        return []
    parts: list[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + size)
        parts.append(clean[start:end])
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return parts


def replace_source_chunks(
    db: Session,
    *,
    org_id: str,
    account_id: str,
    source_type: str,
    source_id: str,
    text: str,
    extra: dict | None = None,
) -> None:
    db.query(Chunk).filter(
        Chunk.org_id == org_id,
        Chunk.source_type == source_type,
        Chunk.source_id == source_id,
    ).delete()
    pieces = chunk_text(text)
    if not pieces:
        return
    vectors = get_embedder().embed(pieces)
    for content, embedding in zip(pieces, vectors, strict=True):
        db.add(
            Chunk(
                id=uid(),
                org_id=org_id,
                account_id=account_id,
                source_type=source_type,
                source_id=source_id,
                content=content,
                embedding=embedding,
                extra=extra or {},
            )
        )


def index_account_snapshot(db: Session, account: Account) -> None:
    contacts = db.query(Contact).filter(Contact.account_id == account.id, Contact.org_id == account.org_id).all()
    contact_lines = [
        f"{c.name} ({c.stakeholder_role}, influence={c.influence}, sentiment={c.sentiment})"
        + (f" title={c.title}" if c.title else "")
        + (f" notes={c.notes}" if c.notes else "")
        for c in contacts
    ]
    body = (
        f"Account {account.name}. Domain {account.domain or 'unknown'}. "
        f"Industry {account.industry or 'unspecified'}. Lifecycle {account.lifecycle}. "
        f"Health {account.health} ({account.health_score}). ARR {account.arr or 0}. "
        f"Tags {', '.join(account.tags or [])}. Description: {account.description or 'none'}. "
        f"Stakeholders: {'; '.join(contact_lines) or 'none recorded'}."
    )
    replace_source_chunks(
        db,
        org_id=account.org_id,
        account_id=account.id,
        source_type="account",
        source_id=account.id,
        text=body,
        extra={"kind": "crm_snapshot"},
    )


def index_timeline(db: Session, event: TimelineEvent) -> None:
    text = f"{event.event_type}: {event.title}. {event.body or ''} Evidence: {event.evidence_excerpt or event.evidence_source or ''}"
    replace_source_chunks(
        db,
        org_id=event.org_id,
        account_id=event.account_id,
        source_type="timeline",
        source_id=event.id,
        text=text,
        extra={"event_type": event.event_type},
    )


def index_risk(db: Session, risk: Risk) -> None:
    text = f"Risk ({risk.severity}, {risk.status}): {risk.title}. {risk.description}"
    replace_source_chunks(db, org_id=risk.org_id, account_id=risk.account_id, source_type="risk", source_id=risk.id, text=text)


def index_opportunity(db: Session, opp: Opportunity) -> None:
    text = f"Opportunity ({opp.status}, value={opp.potential_value}): {opp.title}. {opp.description}. Next: {opp.next_action or 'n/a'}"
    replace_source_chunks(
        db, org_id=opp.org_id, account_id=opp.account_id, source_type="opportunity", source_id=opp.id, text=text
    )


def index_commitment(db: Session, item: Commitment) -> None:
    text = f"Commitment by {item.direction} ({item.status}, due {item.due_date}): {item.description}"
    replace_source_chunks(
        db, org_id=item.org_id, account_id=item.account_id, source_type="commitment", source_id=item.id, text=text
    )


def index_task(db: Session, task: Task) -> None:
    text = f"Task ({task.status}): {task.title}. {task.description or ''} Why: {task.rationale or ''}"
    replace_source_chunks(db, org_id=task.org_id, account_id=task.account_id, source_type="task", source_id=task.id, text=text)


def index_document(db: Session, doc: Document) -> None:
    text = f"Document {doc.filename}. {doc.extracted_text or ''}"
    replace_source_chunks(
        db, org_id=doc.org_id, account_id=doc.account_id, source_type="document", source_id=doc.id, text=text
    )


def index_account_graph(db: Session, account_id: str, org_id: str) -> None:
    account = db.query(Account).filter(Account.id == account_id, Account.org_id == org_id).one()
    index_account_snapshot(db, account)
    for event in db.query(TimelineEvent).filter(TimelineEvent.account_id == account_id, TimelineEvent.org_id == org_id):
        index_timeline(db, event)
    for risk in db.query(Risk).filter(Risk.account_id == account_id, Risk.org_id == org_id):
        index_risk(db, risk)
    for opp in db.query(Opportunity).filter(Opportunity.account_id == account_id, Opportunity.org_id == org_id):
        index_opportunity(db, opp)
    for item in db.query(Commitment).filter(Commitment.account_id == account_id, Commitment.org_id == org_id):
        index_commitment(db, item)
    for task in db.query(Task).filter(Task.account_id == account_id, Task.org_id == org_id):
        index_task(db, task)
    for doc in db.query(Document).filter(Document.account_id == account_id, Document.org_id == org_id):
        index_document(db, doc)
