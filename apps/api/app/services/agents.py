from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import Account, AgentRun, Commitment, Task, uid
from app.services.brief import OPEN_COMMIT, OPEN_RISK, account_bundle, build_grounded_brief
from app.services.health import _aware, recompute_health
from app.services.indexing import index_task


def run_agent(
    db: Session,
    *,
    account: Account,
    action: str,
    user_id: str,
    confirm: bool,
    apply_writes: bool,
) -> AgentRun:
    data = account_bundle(db, account)
    now = data["now"]
    brief = build_grounded_brief(db, account)
    proposed_writes: list[dict[str, Any]] = []
    output: dict[str, Any]

    if action == "prepare_meeting_brief":
        output = {
            "title": f"Meeting brief — {account.name}",
            "summary": brief["executive_summary"],
            "ask_in_the_room": brief["questions_to_ask"],
            "watchouts": [r["title"] for r in brief["risks"][:4]],
            "commitments_to_review": [c["description"] for c in brief["open_commitments"][:4]],
            "stakeholders": brief["key_stakeholders"],
        }
    elif action == "analyze_account_risks":
        ranked = sorted(data["risks"], key=lambda r: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(r.severity, 4))
        output = {
            "open_count": len([r for r in ranked if r.status in OPEN_RISK]),
            "items": [
                {
                    "id": r.id,
                    "title": r.title,
                    "severity": r.severity,
                    "confidence": r.confidence,
                    "why": r.description,
                    "evidence": r.evidence,
                    "status": r.status,
                }
                for r in ranked
                if r.status in OPEN_RISK
            ],
        }
        if not output["items"]:
            output["note"] = "No open risks are stored. Relia will not invent new risks without evidence."
    elif action == "find_expansion_opportunities":
        output = {
            "items": [
                {
                    "id": o.id,
                    "title": o.title,
                    "value": float(o.potential_value) if o.potential_value is not None else None,
                    "status": o.status,
                    "next_action": o.next_action,
                    "evidence": o.evidence,
                    "why": o.description,
                }
                for o in data["opportunities"]
                if o.status in {"identified", "qualifying", "pursuing"}
            ]
        }
        if not output["items"]:
            output["note"] = "No expansion opportunities are stored for this account."
    elif action == "generate_follow_up_plan":
        steps = [a["title"] for a in brief["recommended_next_actions"]]
        for commit in brief["open_commitments"][:3]:
            steps.append(f"Confirm status of: {commit['description']}")
        output = {"steps": steps, "questions": brief["questions_to_ask"]}
        for step in steps[:4]:
            proposed_writes.append({"type": "task", "title": step, "rationale": "Follow-up plan generated from stored account records."})
    elif action == "summarize_recent_changes":
        output = {"changes": brief["recent_changes"], "window_days": 30}
        if not brief["recent_changes"]:
            output["note"] = "No timeline events in the last 30 days are stored."
    elif action == "identify_missing_commitments":
        missing: list[str] = []
        if not any(c.direction == "us" and c.status in OPEN_COMMIT for c in data["commitments"]):
            missing.append("No open promises from us are recorded — check recent meeting notes.")
        if not any(c.direction == "customer" and c.status in OPEN_COMMIT for c in data["commitments"]):
            missing.append("No open customer commitments are recorded.")
        for event in data["events"]:
            body = f"{event.title} {event.body or ''}".lower()
            if "promise" in body or "we will" in body or "they will" in body:
                missing.append(f"Timeline “{event.title}” mentions a promise — confirm it is tracked as a commitment.")
        output = {"gaps": list(dict.fromkeys(missing)), "existing": [c.description for c in data["commitments"]]}
    elif action == "suggest_next_best_actions":
        output = {"actions": brief["recommended_next_actions"]}
        for item in brief["recommended_next_actions"][:5]:
            proposed_writes.append(
                {
                    "type": "task",
                    "title": item["title"],
                    "rationale": item.get("rationale"),
                }
            )
    else:
        output = {"error": "Unknown action"}

    output["proposed_writes"] = proposed_writes
    output["requires_confirmation"] = bool(proposed_writes)
    applied: list[str] = []
    if confirm and apply_writes and proposed_writes:
        for item in proposed_writes:
            if item["type"] == "task":
                task = Task(
                    id=uid(),
                    org_id=account.org_id,
                    account_id=account.id,
                    title=item["title"],
                    rationale=item.get("rationale"),
                    source="ai",
                    owner_id=user_id,
                    due_date=now + timedelta(days=7),
                    status="open",
                )
                db.add(task)
                db.flush()
                index_task(db, task)
                applied.append(task.id)
        recompute_health(db, account)
    output["applied_task_ids"] = applied
    output["generated_at"] = datetime.now(timezone.utc).isoformat()

    run = AgentRun(
        id=uid(),
        org_id=account.org_id,
        account_id=account.id,
        action=action,
        status="applied" if applied else "preview",
        input_payload={"confirm": confirm, "apply_writes": apply_writes},
        output_payload=output,
        confirmed=bool(confirm and apply_writes),
        created_by=user_id,
    )
    db.add(run)
    db.flush()
    return run
