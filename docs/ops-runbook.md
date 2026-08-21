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

## Rollback deployment

- Git/Vercel rollback: revert to the last known-good deployment and confirm the deployed code version matches the intended release.
- Database migration caution: never roll back a migration that has already been applied without a planned schema-compatible recovery.
- Safe plan: if a schema change is required, ship forward-only migration logic and validate the app against the new schema before rollback.

## Readiness and health checks

- `/health` is a process-status endpoint and must not be used for deep dependency validation.
- `/ready` returns a lightweight readiness result for configuration sanity only; it does not perform expensive provider/database calls.
- Do not surface raw provider or DB errors in readiness responses.
