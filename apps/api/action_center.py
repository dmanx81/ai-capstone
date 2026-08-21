from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable


def filter_open_actions(actions: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [action for action in actions if action.get("status") == "open"]


def _as_utc_date(date_value: str | None) -> datetime | None:
    if date_value is None:
        return None
    try:
        return datetime.strptime(date_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def is_action_overdue(action: dict[str, Any], now_iso: str) -> bool:
    if action.get("status") != "open":
        return False
    due_date = action.get("due_date")
    if not due_date:
        return False
    due_at = _as_utc_date(due_date)
    now = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    return due_at is not None and due_at < now


def action_bucket_index(action: dict[str, Any], now_iso: str) -> int:
    due_date = action.get("due_date")
    if not due_date:
        return 3

    due_at = _as_utc_date(due_date)
    now = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    if due_at is None:
        return 3

    diff_days = (due_at.date() - now.date()).days
    if diff_days < 0:
        return 0
    if diff_days <= 7:
        return 1
    if diff_days <= 30:
        return 2
    return 4


def sort_action_rows(actions: Iterable[dict[str, Any]], now_iso: str) -> list[dict[str, Any]]:
    rows = list(actions)
    rows.sort(key=lambda action: (
        action_bucket_index(action, now_iso),
        _as_utc_date(action.get("due_date")).replace(tzinfo=timezone.utc).timestamp() if _as_utc_date(action.get("due_date")) else float("inf"),
        datetime.fromisoformat(action.get("created_at", "1970-01-01T00:00:00Z").replace("Z", "+00:00")).timestamp(),
        action.get("id", ""),
    ))
    return rows


def build_action_update_payload(
    *,
    owner: str | None = None,
    due_date: str | None = None,
    clear_due_date: bool = False,
    status: str | None = None,
    resolved_at: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if owner is not None:
        payload["owner"] = owner
    if clear_due_date:
        payload["due_date"] = None
    elif due_date is not None:
        payload["due_date"] = due_date
    if status is not None:
        payload["status"] = status
        payload["resolved_at"] = resolved_at
    return payload


def get_action_account_id(row: dict[str, Any]) -> str | None:
    return row.get("account_id")
