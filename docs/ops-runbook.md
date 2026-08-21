# Ops Runbook

## Purpose

This runbook covers the operational failure modes for the relationship intelligence application without requiring production data changes during local triage.

## Backup and restore readiness

### Expected backup model

Supabase-managed automated backups are the source of truth for production recovery. This project does not maintain a separate code-managed backup path for live data.

### Restore drill procedure

1. Identify the exact production project and the restore target point-in-time.
2. Confirm the app and worker are in maintenance mode or the user-facing impact is understood.
3. Perform a restore in Supabase only after a documented change window and approval.
4. Verify the restored dataset includes the critical tables:
   - accounts
   - interactions
   - briefs
   - extracted_items
   - chunks
   - analysis_jobs
5. Re-run the app-level auth checks to confirm the restored project still authenticates as expected.
6. Verify that RLS remains enforced and that anonymous/public access is still blocked.
7. Check the per-account relationship ownership path and confirm user-owned data remains isolated.
8. Confirm queued jobs can be claimed again and previously failed jobs are not silently dropped.

This is a manual acceptance procedure: no local restore is performed automatically from this repository.

## LLM provider down

- Primary symptom: `/analyze` and `/relationships/{id}/ask` calls fail.
- What still works: the web app, authenticated portfolio views, Supabase data access, and queued interaction persistence continue to work.
- Queue behavior: the worker records the failure in the interaction and job states, and retries according to the bounded worker policy.
- User impact: new analysis will be delayed or unavailable until the model provider is healthy again.
- Recovery: restore provider connectivity, confirm the env vars remain valid, then allow the queued jobs to reprocess.

## Embedding provider down

- Primary symptom: memory ingestion fails during analysis, but the brief generation remains separate from embeddings.
- What still works: the core analysis brief can still be generated and persisted.
- Best-effort semantics: chunk creation and RAG memory ingestion may fail without breaking the interaction analysis itself.
- Recovery: rerun the backlog or reprocess affected interactions after the embedding provider is healthy again.

## Supabase down

- Primary symptom: web operations and worker processing slow or fail to access the database.
- What continues to work: static frontend assets may still load, but auth and data operations fail once the backend dependency is unavailable.
- Worker behavior: queued jobs remain queued until the database is reachable again.
- Recovery: confirm Supabase availability, verify service-role credentials are still valid, and monitor job queues for resumption.

## Worker down

- Expected queue state: jobs remain queued in `analysis_jobs` while the worker is stopped.
- How to identify stuck jobs: look for rows with `status = 'analyzing'`, `started_at` older than expected, and `attempts` that indicate the worker is retrying without progress; review `interactions.analysis_started_at` and `interactions.analysis_attempts` for the linked interaction as well.
- How to restart worker: run the worker command with the project environment loaded and confirm the required env vars exist.
- Recovery: verify the worker has network access, then allow the queue to drain again.

## Systemd worker service

The repo includes an example unit for the background worker at `deploy/systemd/relationship-worker.service`. It is designed for service supervision without embedding secrets in the unit file. Required secrets such as `SUPABASE_SERVICE_ROLE_KEY` must be stored in a protected `EnvironmentFile` readable only by the service account and must never be committed or embedded directly in the systemd unit. Keep only non-secret values in the unit file itself.

### Install and enable

```sh
sudo install -d /etc/systemd/system
sudo cp deploy/systemd/relationship-worker.service /etc/systemd/system/relationship-worker.service
sudo systemctl daemon-reload
sudo systemctl enable relationship-worker
```

### Start, status, restart, stop

```sh
sudo systemctl start relationship-worker
sudo systemctl status relationship-worker --no-pager
sudo systemctl restart relationship-worker
sudo systemctl stop relationship-worker
```

### Journal logs

```sh
sudo journalctl -u relationship-worker -f
sudo journalctl -u relationship-worker -n 100 --no-pager
```

### Confirm the worker is draining queued jobs

```sh
sudo systemctl status relationship-worker --no-pager
sudo journalctl -u relationship-worker -f
```

Check for repeated `job_account_mismatch`, `job_missing_interaction`, and queued job transitions in the application logs. A healthy worker should reduce `analysis_jobs` rows in `queued` or `analyzing` states as work completes and restarts only on real failures.

### Roll back to manual execution

```sh
sudo systemctl stop relationship-worker
PYTHONPATH=. SUPABASE_URL="${SUPABASE_URL}" SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" python -m apps.api.worker --poll-interval 5
```

This is for incident response only. Never run the service with credentials embedded directly in a unit file or shell history.

## Stale job monitoring

Use the script in `scripts/check_stale_analysis_jobs.py` to find rows older than the operational threshold. The default window is 10 minutes for both `queued` and `analyzing` jobs.

```sh
source .venv/bin/activate
SUPABASE_URL="${SUPABASE_URL}" SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" python scripts/check_stale_analysis_jobs.py
```

The script exits nonzero when stale rows are present so cron, n8n, or a monitoring system can alert. Example integrations:

- cron: run every 5 minutes and alert on exit code 1
- n8n: trigger a workflow if the script exits nonzero
- Telegram: use the shell output as a short alert body

## Rollback deployment

- Git/Vercel rollback: revert to the last known-good deployment and confirm the deployed code version matches the intended release.
- Database migration caution: never roll back a migration that has already been applied without a planned schema-compatible recovery.
- Safe plan: if a schema change is required, ship forward-only migration logic and validate the app against the new schema before rollback.

## Readiness and health checks

- `/health` is a process-status endpoint and must not be used for deep dependency validation.
- `/ready` returns a lightweight readiness result for configuration sanity only; it does not perform expensive provider/database calls.
- Do not surface raw provider or DB errors in readiness responses.
