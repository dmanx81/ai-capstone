from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

SignalSeverity = str
SignalType = str

PRIORITY = {
    "health_drop": 1,
    "renewal_critical": 2,
    "high_risk": 3,
    "failed_analysis": 4,
    "overdue_action": 5,
    "renewal_soon": 6,
    "health_decline": 7,
    "stale_relationship": 8,
    "multiple_open_risks": 9,
    "no_health_score": 10,
}


def _parse_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _days_between(start_iso: str | None, end_iso: str) -> int | None:
    if start_iso is None:
        return None
    start = _parse_iso(start_iso)
    end = _parse_iso(end_iso)
    if start is None or end is None:
        return None
    return (end - start).days


def _renewal_window_days(renewal_date: str | None, now_iso: str) -> int | None:
    if renewal_date is None:
        return None
    try:
        renewal = datetime.strptime(renewal_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    now = _parse_iso(now_iso)
    if now is None:
        return None
    return (renewal - now).days


def _make_signal(
    account_id: str,
    signal_type: SignalType,
    severity: SignalSeverity,
    title: str,
    detail: str,
    now_iso: str,
    source_type: str,
    source_id: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{account_id}-{signal_type}-{source_id or 'root'}",
        "account_id": account_id,
        "type": signal_type,
        "severity": severity,
        "title": title,
        "detail": detail,
        "detected_at": now_iso,
        "source_type": source_type,
        "source_id": source_id,
        "status": status,
    }


def priority_for_signal(signal_type: str) -> int:
    return PRIORITY.get(signal_type, 99)


def derive_failed_analysis_by_account(
    interactions: Iterable[dict[str, Any]],
) -> dict[str, bool]:
    latest_failed_analysis: dict[str, bool] = {}
    for interaction in interactions:
        account_id = interaction.get("account_id")
        if account_id is None or account_id in latest_failed_analysis:
            continue

        latest_failed_analysis[account_id] = interaction.get("analysis_status") == "failed"
    return latest_failed_analysis


def compute_account_signals(
    *,
    account_id: str,
    latest_health_score: int | None = None,
    previous_health_score: int | None = None,
    renewal_date: str | None = None,
    last_interaction_at: str | None = None,
    open_risks: int = 0,
    high_severity_open_risk_count: int = 0,
    overdue_action_count: int = 0,
    failed_analysis: bool = False,
    now_iso: str | None = None,
) -> list[dict[str, Any]]:
    now = now_iso or datetime.now(timezone.utc).isoformat()
    signals: list[dict[str, Any]] = []

    has_health_score = latest_health_score is not None
    has_previous_health_score = previous_health_score is not None

    if not has_health_score and not has_previous_health_score:
        signals.append(
            _make_signal(
                account_id,
                "no_health_score",
                "info",
                "No health history",
                "This relationship has not yet produced a health score.",
                now,
                "health",
            )
        )

    if (
        has_health_score
        and has_previous_health_score
        and previous_health_score is not None
        and latest_health_score is not None
    ):
        drop = previous_health_score - latest_health_score
        if drop >= 15:
            signals.append(
                _make_signal(
                    account_id,
                    "health_drop",
                    "critical",
                    "Health dropped",
                    f"Health dropped from {previous_health_score} to {latest_health_score}.",
                    now,
                    "health",
                )
            )
        elif drop >= 8:
            signals.append(
                _make_signal(
                    account_id,
                    "health_decline",
                    "warning",
                    "Health declined",
                    f"Health declined from {previous_health_score} to {latest_health_score}.",
                    now,
                    "health",
                )
            )

    renewal_days = _renewal_window_days(renewal_date, now)
    if renewal_days is not None and 0 <= renewal_days <= 30:
        signals.append(
            _make_signal(
                account_id,
                "renewal_critical",
                "critical",
                "Renewal approaching",
                f"Renewal is in {renewal_days} days.",
                now,
                "renewal",
            )
        )
    elif renewal_days is not None and 30 < renewal_days <= 90:
        signals.append(
            _make_signal(
                account_id,
                "renewal_soon",
                "warning",
                "Renewal coming soon",
                f"Renewal is in {renewal_days} days.",
                now,
                "renewal",
            )
        )

    if high_severity_open_risk_count > 0:
        signals.append(
            _make_signal(
                account_id,
                "high_risk",
                "critical",
                "High-severity risk open",
                f"There are {high_severity_open_risk_count} open high-severity risks.",
                now,
                "risk",
            )
        )

    if open_risks >= 3 and high_severity_open_risk_count == 0:
        signals.append(
            _make_signal(
                account_id,
                "multiple_open_risks",
                "warning",
                "Multiple open risks",
                f"There are {open_risks} open risks currently tracked.",
                now,
                "risk",
            )
        )

    if last_interaction_at is not None:
        days_since = _days_between(last_interaction_at, now)
        if days_since is not None and days_since > 30:
            signals.append(
                _make_signal(
                    account_id,
                    "stale_relationship",
                    "warning",
                    "Relationship is stale",
                    f"Last interaction was {days_since} days ago.",
                    now,
                    "interaction",
                )
            )
    else:
        signals.append(
            _make_signal(
                account_id,
                "stale_relationship",
                "warning",
                "No interaction recorded yet",
                "No interaction recorded yet.",
                now,
                "interaction",
            )
        )

    if overdue_action_count > 0:
        signals.append(
            _make_signal(
                account_id,
                "overdue_action",
                "warning",
                "Overdue action",
                f"There are {overdue_action_count} overdue open actions.",
                now,
                "action",
            )
        )

    if failed_analysis:
        signals.append(
            _make_signal(
                account_id,
                "failed_analysis",
                "warning",
                "Analysis failed",
                "The latest analysis failed and requires a retry.",
                now,
                "analysis",
            )
        )

    signals.sort(key=lambda item: priority_for_signal(item["type"]))
    return signals
