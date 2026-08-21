import argparse
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests

from apps.api.analyzer import analyze_account, get_configured_model_name
from apps.api.embeddings import ingest_interaction_memory, retrieve_relationship_context

logger = logging.getLogger("analysis_worker")


def _job_log_fields(job_id: Any, **kwargs: Any) -> dict[str, Any]:
    payload = {"job_id": str(job_id), **kwargs}
    return {key: value for key, value in payload.items() if value is not None}


def sanitize_analysis_error(raw_error: Any) -> str:
    message = str(raw_error) if raw_error is not None else "Unknown analysis failure"
    redacted = message

    for token in (
        os.getenv("OPENROUTER_API_KEY", ""),
        os.getenv("OPENAI_API_KEY", ""),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    ):
        if token:
            redacted = redacted.replace(token, "[REDACTED]")

    redacted = re.sub(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+", r"\1=[REDACTED]", redacted)
    redacted = re.sub(r"(?i)(Authorization\s*:\s*Bearer\s+|bearer\s+)([A-Za-z0-9._~+/=-]+)", r"Authorization: Bearer [REDACTED]", redacted)
    redacted = re.sub(r"(?i)(jwt|bearer|token|authorization)[^\n\r]*[:=][^\n\r,;]+", r"\1=[REDACTED]", redacted)
    redacted = re.sub(r"(?i)(customer_text|raw_text|prompt|query|instructions?)\s*[:=]\s*.+", r"\1=[REDACTED]", redacted)
    redacted = re.sub(r"(?i)service[-_ ]role[^\n\r]*[:=][^\n\r,;]+", "service-role=[REDACTED]", redacted)
    return redacted[:1000]


def get_supabase_url() -> str:
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        raise RuntimeError("SUPABASE_URL is required for the analysis worker")
    return supabase_url.rstrip("/")


def get_service_role_token() -> str:
    token = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not token:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for the analysis worker")
    return token


def _base_headers(service_token: str) -> dict[str, str]:
    return {
        "apikey": service_token,
        "Authorization": f"Bearer {service_token}",
        "Content-Type": "application/json",
    }


def claim_next_job(supabase_url: str, service_token: str) -> Optional[dict[str, Any]]:
    url = f"{supabase_url}/rest/v1/rpc/claim_next_analysis_job"
    response = requests.post(url, headers=_base_headers(service_token), timeout=30)
    response.raise_for_status()
    rows = response.json() or []
    return rows[0] if rows else None


def fetch_interaction(supabase_url: str, service_token: str, interaction_id: str) -> Optional[dict[str, Any]]:
    url = f"{supabase_url}/rest/v1/interactions"
    params = {
        "id": f"eq.{interaction_id}",
        "select": "id,account_id,raw_text,analysis_status,analysis_error,analysis_attempts,created_at",
    }
    response = requests.get(url, headers=_base_headers(service_token), params=params, timeout=30)
    response.raise_for_status()
    rows = response.json() or []
    return rows[0] if rows else None


def update_interaction_status(
    supabase_url: str,
    service_token: str,
    interaction_id: str,
    status: str,
    analysis_error: Optional[str] = None,
    analysis_started_at: Optional[str] = None,
    analysis_completed_at: Optional[str] = None,
    analysis_attempts: Optional[int] = None,
) -> None:
    payload: dict[str, Any] = {"analysis_status": status}
    if analysis_error is not None:
        payload["analysis_error"] = analysis_error
    else:
        payload["analysis_error"] = None
    if analysis_started_at is not None:
        payload["analysis_started_at"] = analysis_started_at
    if analysis_completed_at is not None:
        payload["analysis_completed_at"] = analysis_completed_at
    if analysis_attempts is not None:
        payload["analysis_attempts"] = analysis_attempts
    response = requests.patch(
        f"{supabase_url}/rest/v1/interactions?id=eq.{interaction_id}",
        headers=_base_headers(service_token),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()


def update_job_status(
    supabase_url: str,
    service_token: str,
    job_id: str,
    status: str,
    last_error: Optional[str] = None,
    attempts: Optional[int] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
) -> None:
    payload: dict[str, Any] = {"status": status}
    if last_error is not None:
        payload["last_error"] = last_error
    else:
        payload["last_error"] = None
    if attempts is not None:
        payload["attempts"] = attempts
    if started_at is not None:
        payload["started_at"] = started_at
    if completed_at is not None:
        payload["completed_at"] = completed_at
    response = requests.patch(
        f"{supabase_url}/rest/v1/analysis_jobs?id=eq.{job_id}",
        headers=_base_headers(service_token),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()


def get_existing_brief(supabase_url: str, service_token: str, interaction_id: str) -> Optional[dict[str, Any]]:
    url = f"{supabase_url}/rest/v1/briefs"
    params = {"interaction_id": f"eq.{interaction_id}", "select": "id,account_id,interaction_id"}
    response = requests.get(url, headers=_base_headers(service_token), params=params, timeout=30)
    response.raise_for_status()
    rows = response.json() or []
    return rows[0] if rows else None


def persist_brief_and_items(
    supabase_url: str,
    service_token: str,
    account_id: str,
    interaction_id: str,
    brief: Any,
    model_used: str,
) -> tuple[str, str]:
    brief_payload = brief.model_dump() if hasattr(brief, "model_dump") else dict(brief)
    brief_payload["model_used"] = model_used

    existing = get_existing_brief(supabase_url, service_token, interaction_id)
    if existing:
        brief_id = existing["id"]
        requests.delete(
            f"{supabase_url}/rest/v1/extracted_items",
            headers=_base_headers(service_token),
            params={"brief_id": f"eq.{brief_id}"},
            timeout=30,
        ).raise_for_status()
        response = requests.patch(
            f"{supabase_url}/rest/v1/briefs?id=eq.{brief_id}",
            headers=_base_headers(service_token),
            json={
                "content_json": brief_payload,
                "health_score": brief_payload.get("health_score"),
                "model_used": model_used,
            },
            timeout=30,
        )
        response.raise_for_status()
    else:
        response = requests.post(
            f"{supabase_url}/rest/v1/briefs",
            headers={**_base_headers(service_token), "Prefer": "return=representation"},
            json={
                "account_id": account_id,
                "interaction_id": interaction_id,
                "content_json": brief_payload,
                "health_score": brief_payload.get("health_score"),
                "model_used": model_used,
            },
            timeout=30,
        )
        response.raise_for_status()
        rows = response.json() or []
        if not rows:
            raise RuntimeError("Brief persistence did not return a row")
        brief_id = rows[0]["id"]

    items: list[dict[str, Any]] = []
    for risk in brief_payload.get("risks", []):
        items.append({
            "account_id": account_id,
            "brief_id": brief_id,
            "kind": "risk",
            "title": risk["title"],
            "severity": risk.get("severity"),
            "confidence": risk.get("confidence"),
            "owner": None,
            "evidence": risk.get("evidence"),
            "direction": None,
            "detail": "\n".join([
                f"Severity: {risk.get('severity')}",
                f"Confidence: {int(float(risk.get('confidence', 0)) * 100)}%",
                f"Evidence: {risk.get('evidence')}",
            ]),
            "status": "open",
            "due_date": None,
        })
    for opportunity in brief_payload.get("opportunities", []):
        items.append({
            "account_id": account_id,
            "brief_id": brief_id,
            "kind": "opportunity",
            "title": opportunity["title"],
            "severity": None,
            "confidence": None,
            "owner": None,
            "evidence": opportunity.get("evidence"),
            "direction": None,
            "detail": "\n".join([
                f"Evidence: {opportunity.get('evidence')}",
                f"Recommended action: {opportunity.get('recommended_action')}",
            ]),
            "status": "open",
            "due_date": None,
        })
    for action in brief_payload.get("action_items", []):
        items.append({
            "account_id": account_id,
            "brief_id": brief_id,
            "kind": "action",
            "title": action["action"],
            "severity": None,
            "confidence": None,
            "owner": action.get("owner"),
            "evidence": action.get("evidence"),
            "direction": None,
            "detail": "\n".join([
                item for item in [
                    f"Owner: {action.get('owner')}" if action.get("owner") else None,
                    f"Deadline: {action.get('deadline')}" if action.get("deadline") else None,
                    f"Evidence: {action.get('evidence')}",
                ] if item is not None
            ]),
            "status": "open",
            "due_date": None,
        })

    if items:
        insert_response = requests.post(
            f"{supabase_url}/rest/v1/extracted_items",
            headers=_base_headers(service_token),
            json=items,
            timeout=30,
        )
        insert_response.raise_for_status()

    return brief_id, model_used


def perform_analysis(account_id: str, interaction_id: str, raw_text: str, access_token: str) -> Any:
    try:
        context = retrieve_relationship_context(
            account_id,
            raw_text,
            access_token,
            match_count=3,
        )
    except Exception:
        context = []

    filtered_context = [chunk for chunk in context if chunk.interaction_id != interaction_id]
    brief = analyze_account(raw_text, filtered_context)
    ingest_interaction_memory(account_id, interaction_id, raw_text, access_token)
    return brief


def process_job(job: dict[str, Any], supabase_url: str, service_token: str) -> dict[str, Any]:
    interaction_id = str(job["interaction_id"])
    account_id = str(job["account_id"])
    interaction = fetch_interaction(supabase_url, service_token, interaction_id)
    if not interaction:
        update_job_status(supabase_url, service_token, str(job["id"]), "failed", "Interaction no longer exists", attempts=int(job.get("attempts", 0)))
        logger.warning(
            "job_missing_interaction",
            extra={**_job_log_fields(job.get("id"), interaction_id=interaction_id, account_id=account_id, analysis_status="failed", attempts=int(job.get("attempts", 0)))},
        )
        return {"success": False, "interaction_id": interaction_id, "status": "failed"}

    interaction_account_id = getattr(interaction, "account_id", None)
    if interaction_account_id is None and isinstance(interaction, dict):
        interaction_account_id = interaction.get("account_id")
    interaction_raw_text = getattr(interaction, "raw_text", None)
    if interaction_raw_text is None and isinstance(interaction, dict):
        interaction_raw_text = interaction.get("raw_text")
    existing_attempts = getattr(interaction, "analysis_attempts", None)
    if existing_attempts is None and isinstance(interaction, dict):
        existing_attempts = interaction.get("analysis_attempts", 0)
    attempts_value = int(job.get("attempts", existing_attempts or 0) or 0)

    if interaction_account_id is None or str(interaction_account_id) != account_id:
        safe_error = "Interaction/account mismatch detected"
        update_job_status(
            supabase_url,
            service_token,
            str(job["id"]),
            "failed",
            last_error=safe_error,
            attempts=attempts_value,
        )
        logger.warning(
            "job_account_mismatch",
            extra={**_job_log_fields(job.get("id"), interaction_id=interaction_id, account_id=account_id, interaction_account_id=str(interaction_account_id) if interaction_account_id is not None else None, analysis_status="failed", attempts=attempts_value)},
        )
        return {"success": False, "interaction_id": interaction_id, "status": "failed", "error": safe_error}

    started_at = datetime.now(timezone.utc).isoformat()
    update_interaction_status(
        supabase_url,
        service_token,
        interaction_id,
        "analyzing",
        analysis_started_at=started_at,
        analysis_attempts=attempts_value,
    )
    update_job_status(
        supabase_url,
        service_token,
        str(job["id"]),
        "analyzing",
        attempts=attempts_value,
        started_at=started_at,
    )

    try:
        brief = perform_analysis(account_id, interaction_id, interaction_raw_text, service_token)
        _, _ = persist_brief_and_items(supabase_url, service_token, account_id, interaction_id, brief, get_configured_model_name())
        completed_at = datetime.now(timezone.utc).isoformat()
        update_interaction_status(
            supabase_url,
            service_token,
            interaction_id,
            "complete",
            analysis_error=None,
            analysis_completed_at=completed_at,
            analysis_attempts=attempts_value,
        )
        update_job_status(
            supabase_url,
            service_token,
            str(job["id"]),
            "complete",
            attempts=attempts_value,
            completed_at=completed_at,
        )
        return {"success": True, "interaction_id": interaction_id, "status": "complete"}
    except Exception as error:
        safe_error = sanitize_analysis_error(error)
        logger.warning(
            "analysis_failed",
            extra={**_job_log_fields(job.get("id"), account_id=account_id, interaction_id=interaction_id, analysis_status="failed", error_category=type(error).__name__, attempts=attempts_value)},
            exc_info=True,
        )
        completed_at = datetime.now(timezone.utc).isoformat()
        update_interaction_status(
            supabase_url,
            service_token,
            interaction_id,
            "failed",
            analysis_error=safe_error,
            analysis_completed_at=completed_at,
            analysis_attempts=attempts_value,
        )
        update_job_status(
            supabase_url,
            service_token,
            str(job["id"]),
            "failed",
            last_error=safe_error,
            attempts=attempts_value,
            completed_at=completed_at,
        )
        return {"success": False, "interaction_id": interaction_id, "status": "failed", "error": safe_error}


def run_worker(poll_interval_seconds: int = 5) -> None:
    supabase_url = get_supabase_url()
    service_token = get_service_role_token()
    logger.info("Starting async analysis worker for %s", supabase_url)

    while True:
        try:
            job = claim_next_job(supabase_url, service_token)
            if job is None:
                time.sleep(poll_interval_seconds)
                continue
            process_job(job, supabase_url, service_token)
        except Exception as error:
            logger.warning("Worker loop error: %s", sanitize_analysis_error(error), exc_info=True)
            time.sleep(poll_interval_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the relationship analysis worker")
    parser.add_argument("--poll-interval", type=int, default=5, help="Seconds to wait when no jobs are queued")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    run_worker(poll_interval_seconds=max(1, args.poll_interval))


if __name__ == "__main__":
    main()
