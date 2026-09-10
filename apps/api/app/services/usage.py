from __future__ import annotations

from time import perf_counter

from sqlalchemy.orm import Session

from app.models import AiUsageEvent, uid


def log_ai_usage(
    db: Session,
    *,
    org_id: str,
    user_id: str | None,
    action: str,
    model: str,
    success: bool = True,
    error: str | None = None,
    started_at: float | None = None,
) -> None:
    latency_ms = int((perf_counter() - started_at) * 1000) if started_at is not None else 0
    db.add(
        AiUsageEvent(
            id=uid(),
            org_id=org_id,
            user_id=user_id,
            action=action,
            model=model,
            success=success,
            error=(error or "")[:500] or None,
            latency_ms=max(latency_ms, 0),
        )
    )
