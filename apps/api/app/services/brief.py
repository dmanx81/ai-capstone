from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.ai.llm import get_llm
from app.config import get_settings
from app.models import Account, Commitment, Contact, Opportunity, Risk, Task, TimelineEvent
from app.services.health import _aware, recompute_health
from app.services.retrieval import match_chunks

settings = get_settings()
OPEN_RISK = {"open", "monitoring"}
OPEN_COMMIT = {"open", "in_progress"}
OPEN_OPP = {"identified", "qualifying", "pursuing"}
OPEN_TASK = {"open", "in_progress"}


def _iso(dt: datetime | None) -> str | None:
    return _aware(dt).isoformat() if dt else None


def account_bundle(db: Session, account: Account) -> dict[str, Any]:
    recompute_health(db, account)
    now = datetime.now(timezone.utc)
    contacts = db.query(Contact).filter(Contact.account_id == account.id, Contact.org_id == account.org_id).all()
    risks = db.query(Risk).filter(Risk.account_id == account.id, Risk.org_id == account.org_id).all()
    opps = db.query(Opportunity).filter(Opportunity.account_id == account.id, Opportunity.org_id == account.org_id).all()
    commits = db.query(Commitment).filter(Commitment.account_id == account.id, Commitment.org_id == account.org_id).all()
    tasks = db.query(Task).filter(Task.account_id == account.id, Task.org_id == account.org_id).all()
    events = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.account_id == account.id, TimelineEvent.org_id == account.org_id)
        .order_by(TimelineEvent.occurred_at.desc())
        .limit(40)
        .all()
    )
    return {
        "account": account,
        "contacts": contacts,
        "risks": risks,
        "opportunities": opps,
        "commitments": commits,
        "tasks": tasks,
        "events": events,
        "now": now,
    }


def build_grounded_brief(db: Session, account: Account) -> dict[str, Any]:
    data = account_bundle(db, account)
    account = data["account"]
    now: datetime = data["now"]
    horizon = now - timedelta(days=30)

    open_risks = [r for r in data["risks"] if r.status in OPEN_RISK]
    open_opps = [o for o in data["opportunities"] if o.status in OPEN_OPP]
    open_commits = [c for c in data["commitments"] if c.status in OPEN_COMMIT]
    open_tasks = [t for t in data["tasks"] if t.status in OPEN_TASK]
    recent = [e for e in data["events"] if _aware(e.occurred_at) >= horizon]
    overdue = [c for c in open_commits if c.due_date and _aware(c.due_date) < now]
    upcoming = sorted(
        [
            *[
                {
                    "kind": "commitment",
                    "label": c.description,
                    "due": _iso(c.due_date),
                    "id": c.id,
                }
                for c in open_commits
                if c.due_date
            ],
            *[
                {"kind": "task", "label": t.title, "due": _iso(t.due_date), "id": t.id}
                for t in open_tasks
                if t.due_date
            ],
            *(
                [{"kind": "renewal", "label": f"{account.name} renewal", "due": _iso(account.renewal_date), "id": account.id}]
                if account.renewal_date
                else []
            ),
        ],
        key=lambda row: row.get("due") or "9999",
    )[:8]

    risk_titles = ", ".join(r.title for r in open_risks[:3]) or "no open risks on file"
    summary_bits = [
        f"{account.name} is {account.lifecycle.replace('_', ' ')} with relationship health {account.health} ({account.health_score}/100).",
        f"Open risks: {len(open_risks)} ({risk_titles}).",
        f"Open opportunities: {len(open_opps)}.",
        f"Open commitments: {len(open_commits)} ({len(overdue)} overdue).",
        f"{len(recent)} timeline events in the last 30 days.",
    ]
    if account.arr:
        summary_bits.insert(1, f"Contract value on file is ${float(account.arr):,.0f} ARR.")

    questions: list[str] = []
    for risk in open_risks[:3]:
        questions.append(f"What is the current status of “{risk.title}”, and who owns mitigation?")
    for commit in overdue[:2]:
        questions.append(f"Can we reset the date on the overdue promise: {commit.description}?")
    unknown = [c for c in data["contacts"] if c.sentiment == "unknown" and c.influence == "high"]
    for person in unknown[:2]:
        questions.append(f"How does {person.name} currently feel about the partnership?")
    if account.renewal_date:
        questions.append("Are we aligned on success criteria for the upcoming renewal conversation?")
    if not questions:
        questions.append("What would make this relationship more successful over the next quarter?")

    actions: list[dict[str, Any]] = []
    for risk in sorted(open_risks, key=lambda r: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(r.severity, 4))[:3]:
        actions.append(
            {
                "title": f"Mitigate: {risk.title}",
                "rationale": f"Open {risk.severity} risk (confidence {risk.confidence:.0%}).",
                "evidence": risk.evidence or [{"source_type": "risk", "source_id": risk.id, "excerpt": risk.description[:240]}],
            }
        )
    for commit in overdue[:2]:
        actions.append(
            {
                "title": f"Close or renegotiate: {commit.description}",
                "rationale": "Commitment is past its due date.",
                "evidence": commit.evidence
                or [{"source_type": "commitment", "source_id": commit.id, "excerpt": commit.description}],
            }
        )
    champions = [c for c in data["contacts"] if c.stakeholder_role == "champion"]
    if not champions:
        actions.append(
            {
                "title": "Identify an executive champion",
                "rationale": "No champion is recorded on this account.",
                "evidence": [{"source_type": "account", "source_id": account.id, "excerpt": "Stakeholder roster has no champion."}],
            }
        )

    brief = {
        "executive_summary": " ".join(summary_bits),
        "relationship_health": {
            "label": account.health,
            "score": account.health_score,
            "drivers": [
                f"{len(open_risks)} open risks",
                f"{len(overdue)} overdue commitments",
                f"{len(recent)} events in 30 days",
            ],
        },
        "recent_changes": [
            {
                "title": e.title,
                "occurred_at": _iso(e.occurred_at),
                "type": e.event_type,
                "evidence": {
                    "source_type": "timeline",
                    "source_id": e.id,
                    "excerpt": (e.body or e.title)[:280],
                },
            }
            for e in recent[:8]
        ],
        "key_stakeholders": [
            {
                "name": c.name,
                "title": c.title,
                "role": c.stakeholder_role,
                "influence": c.influence,
                "sentiment": c.sentiment,
                "id": c.id,
            }
            for c in data["contacts"]
        ],
        "risks": [
            {
                "id": r.id,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "confidence": r.confidence,
                "evidence": r.evidence
                or [{"source_type": "risk", "source_id": r.id, "excerpt": r.description[:280]}],
            }
            for r in open_risks
        ],
        "opportunities": [
            {
                "id": o.id,
                "title": o.title,
                "status": o.status,
                "potential_value": float(o.potential_value) if o.potential_value is not None else None,
                "confidence": o.confidence,
                "next_action": o.next_action,
                "evidence": o.evidence
                or [{"source_type": "opportunity", "source_id": o.id, "excerpt": o.description[:280]}],
            }
            for o in open_opps
        ],
        "open_commitments": [
            {
                "id": c.id,
                "description": c.description,
                "direction": c.direction,
                "due_date": _iso(c.due_date),
                "status": c.status,
                "overdue": bool(c.due_date and _aware(c.due_date) < now),
                "evidence": c.evidence
                or [{"source_type": "commitment", "source_id": c.id, "excerpt": c.description}],
            }
            for c in open_commits
        ],
        "upcoming_deadlines": upcoming,
        "recommended_next_actions": actions,
        "questions_to_ask": questions[:8],
        "model": settings.llm_provider,
        "disclaimer": "Every statement is drawn from records stored for this account. Relia does not invent customer facts.",
    }

    llm = get_llm()
    if llm.name != "grounded":
        chunks = match_chunks(db, org_id=account.org_id, query="account relationship summary risks opportunities commitments", account_id=account.id, match_count=10)
        try:
            polished = llm.complete_json(
                system=(
                    "You write account briefs for customer teams. Use ONLY the JSON evidence provided. "
                    "Do not invent people, dates, dollar amounts, or events. Return JSON with the same keys "
                    "as the grounded brief. Each insight must keep its evidence array. If evidence is missing, omit the claim."
                ),
                user=str({"grounded_brief": brief, "retrieved_chunks": [c.content for c in chunks]}),
            )
            for key in brief:
                if key in polished:
                    brief[key] = polished[key]
            brief["model"] = llm.name
        except Exception:
            brief["model"] = f"{settings.llm_provider}_fallback_grounded"
    return brief


def answer_question(db: Session, org_id: str, question: str, account_id: str | None) -> dict[str, Any]:
    chunks = match_chunks(db, org_id=org_id, query=question, account_id=account_id, match_count=8)
    evidence = [
        {
            "chunk_id": c.id,
            "account_id": c.account_id,
            "source_type": c.source_type,
            "source_id": c.source_id,
            "excerpt": c.content[:400],
            "similarity": c.similarity,
        }
        for c in chunks
    ]
    q = question.lower()
    structured: list[str] = []
    if account_id:
        account = db.query(Account).filter(Account.id == account_id, Account.org_id == org_id).one_or_none()
        if account:
            data = account_bundle(db, account)
            now = data["now"]
            if any(word in q for word in ("risk", "at risk", "churn")):
                for risk in data["risks"]:
                    if risk.status in OPEN_RISK:
                        structured.append(f"{risk.severity.upper()} risk: {risk.title} — {risk.description}")
            if any(word in q for word in ("promise", "commit", "owed")):
                for item in data["commitments"]:
                    if item.status in OPEN_COMMIT:
                        who = "We promised" if item.direction == "us" else "They promised"
                        structured.append(f"{who}: {item.description}" + (f" (due {_iso(item.due_date)})" if item.due_date else ""))
            if any(word in q for word in ("chang", "last 30", "recent", "happen")):
                for event in data["events"][:8]:
                    if _aware(event.occurred_at) >= now - timedelta(days=30):
                        structured.append(f"{event.occurred_at.date()}: {event.title}")
            if any(word in q for word in ("stakeholder", "who", "champion", "contact")):
                for person in data["contacts"]:
                    structured.append(
                        f"{person.name} — {person.stakeholder_role}, influence {person.influence}, sentiment {person.sentiment}"
                    )
            if any(word in q for word in ("meeting", "discuss", "tomorrow", "ask")):
                brief = build_grounded_brief(db, account)
                structured.extend(brief["questions_to_ask"][:5])
                structured.extend(a["title"] for a in brief["recommended_next_actions"][:3])

    llm = get_llm()
    answer = ""
    if structured:
        answer = "Based on stored records:\n- " + "\n- ".join(structured[:12])
    elif evidence:
        answer = "Retrieved account evidence (no additional claims):\n- " + "\n- ".join(e["excerpt"] for e in evidence[:5])
    else:
        answer = "No stored evidence matched this question. Relia will not guess."

    if llm.name != "grounded" and (structured or evidence):
        try:
            result = llm.complete_json(
                system=(
                    "Answer only with the provided evidence. If the evidence is insufficient, say so. "
                    "Return JSON {answer: string, used_evidence_ids: string[]}. Never invent facts."
                ),
                user=str({"question": question, "structured": structured, "evidence": evidence}),
            )
            answer = str(result.get("answer") or answer)
        except Exception:
            pass

    return {
        "question": question,
        "answer": answer,
        "evidence": evidence,
        "model": settings.llm_provider,
        "grounded": True,
    }
