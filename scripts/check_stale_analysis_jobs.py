#!/usr/bin/env python3
import os
import sys

import requests


def main() -> int:
    supabase_url = os.getenv("SUPABASE_URL")
    service_token = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_token:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required", file=sys.stderr)
        return 2

    threshold_minutes = int(os.getenv("STALE_JOB_THRESHOLD_MINUTES", "10"))
    threshold_seconds = threshold_minutes * 60

    url = f"{supabase_url.rstrip('/')}/rest/v1/analysis_jobs"
    params = {
        "select": "id,status,created_at,started_at,attempts",
        "status": "in.(queued,analyzing)",
        "or": f"(created_at.lt.{( __import__('datetime').datetime.utcnow() - __import__('datetime').timedelta(seconds=threshold_seconds) ).strftime('%Y-%m-%dT%H:%M:%SZ')},started_at.lt.{( __import__('datetime').datetime.utcnow() - __import__('datetime').timedelta(seconds=threshold_seconds) ).strftime('%Y-%m-%dT%H:%M:%SZ')})",
    }
    response = requests.get(
        url,
        headers={
            "apikey": service_token,
            "Authorization": f"Bearer {service_token}",
            "Content-Type": "application/json",
        },
        params=params,
        timeout=30,
    )
    response.raise_for_status()
    rows = response.json() or []

    if not rows:
        print("No stale analysis jobs")
        return 0

    for row in rows:
        print(
            "{id}\t{status}\t{created_at}\t{started_at}\t{attempts}".format(
                id=row.get("id"),
                status=row.get("status"),
                created_at=row.get("created_at"),
                started_at=row.get("started_at"),
                attempts=row.get("attempts", 0),
            )
        )
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.RequestException as exc:
        print(f"stale job check failed: {exc}", file=sys.stderr)
        raise SystemExit(2)
