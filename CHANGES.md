# Changes

## Session 3 - Relationship Health Score

Added an explainable 0-100 relationship health score and one-sentence
justification to newly generated account briefs. Scores are validated by
Pydantic, generated into the shared TypeScript contract, persisted in the
existing `briefs.health_score` column, and rendered on the relationship page.
Historical briefs without a score remain supported.

### Golden Scenario Stability

| Scenario | Scores | Range | Result | Note |
| --- | --- | --- | --- | --- |
| `expansion_opportunity` | 90 / 85 / 85 | 5 | Pass | No refinement required. |
| `low_adoption_renewal` | 48 / 55 / 55 | 7 | Pass | Rubric calibration was tightened after the initial range exceeded 10. |
| `prompt_injection_attempt` | 30 / 30 / 35 | 5 | Pass | No refinement required. |

Each scenario was run three times through the existing analysis pipeline.
No raw relationship text or secrets are included here.

## Session 4 - Portfolio Dashboard

The portfolio reads from three fixed queries without adding a new signals table
or any migration churn: the `portfolio_overview` security-invoker view, the
open extracted-item summary for risk/action counts, and the interaction status
history to determine the newest analysis outcome per account. This stays in the
same constant-query pattern and avoids N+1 calls while keeping the logic
explainable and deterministic.

Needs-attention sorting uses lowest available health first, then nearest renewal,
then longest interaction silence. Missing health is ordered after known scores,
missing renewal after dated relationships, and no interactions are treated as
the stalest relationship for the final criterion. Name and Recent are alternate
sorts using the same fetched rows.

The At risk KPI counts scored relationships below 50, plus relationships with
an upcoming renewal in the next 60 days and at least one open risk. Past-due
renewals are not counted by the renewal rule. Empty relationships, unscored
briefs, no interactions, and missing renewal dates render with explicit null
states.

## Session 5 - Relationship Timeline

The relationship page now loads account, interactions, briefs, and extracted
items with four fixed parallel Supabase data requests after authentication.
Interactions use `interactions.occurred_at` as the event timestamp; briefs use
`created_at` and persisted `health_score`; extracted items use `created_at` for
risk-raised events and the existing `resolved_at` for risk-resolved events.
The existing `accounts.renewal_date` supplies the renewal marker.

The timeline defaults to six months and offers 3 months, 6 months, 12 months,
and All. The selected range filters interaction events and the health chart;
today and renewal markers remain contextual to the selected axis when visible.
Health history uses only non-null persisted scores, without interpolation.
One-point and no-score states are rendered as text instead of inventing a line.

Interaction markers are keyboard-reachable buttons and expose date/type labels,
with the selected interaction notes and related brief score shown as text. Risk
raised/resolved markers use explicit labels rather than color alone. The event
axis scrolls inside its own container on narrow screens, and the chart uses a
responsive container. Renewal remains represented at the selected range edge
when it falls outside that range. Mobile viewport validation was performed with
the production build and narrow-layout browser check.

## Session 6 - Relationship Memory Ingestion

New interactions are chunked deterministically in the API at approximately 500
tokens using 2,000-character chunks with 200-character overlap. Chunks are
embedded with `text-embedding-3-small` at 1,536 dimensions and inserted through
PostgREST with the caller's verified JWT, preserving the existing RLS policies.
Each chunk stores its zero-based source order, and the unique interaction/order
constraint plus deterministic delete/replace makes retries idempotent. It is
best effort: embedding or memory persistence failures are logged by account and
interaction ID without failing the primary analysis, brief, or extracted-item
flow.

The HNSW cosine index is defined in
`supabase/migrations/006_chunks_vector_index.sql`. Existing interactions can be
processed manually with the admin-only `scripts/backfill_embeddings.py`, which
requires `SUPABASE_SERVICE_ROLE_KEY` and is never imported by the API request
path. The API requires `OPENAI_API_KEY` and `SUPABASE_PUBLISHABLE_KEY`; it also
supports optional `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL` settings.

## Session 7 - Relationship Q&A and Historical Context

Relationship retrieval reuses the Session 6 embedding configuration and calls
`public.match_chunks` once through PostgREST with the authenticated caller JWT.
Q&A is exposed at `POST /relationships/{account_id}/ask`, uses at most five
retrieved chunks, and builds bounded source excerpts directly from retrieved
rows rather than asking the model to invent citations. Empty retrieval returns
an insufficient-evidence response without an LLM call.

The `/analyze` path now performs one best-effort historical retrieval of at most
three chunks before analysis, filters out the current interaction, and labels
the current interaction as primary while historical context remains
supplementary. Retrieval failure falls back to current-only analysis. Both
prompts explicitly treat retrieved text as untrusted data and reject embedded
instructions; no migration was required.

## Session 8 - Async Analysis Queue

Session 8 replaces the synchronous `/analyze` request flow with a durable
queued worker model backed by Postgres. The web app inserts a new interaction
with `analysis_status = 'queued'`, creates a single `analysis_jobs` row keyed by
`interaction_id`, and returns immediately without waiting for model analysis or
embedding ingestion. The FastAPI worker runs as a persistent server-side process,
claims one queued row atomically, and processes the linked account/interaction
relationship while keeping the row-level security boundary intact.

The queue schema was added in `supabase/migrations/007_async_analysis.sql`.
It introduces `interactions.analysis_status`, `analysis_error`,
`analysis_started_at`, `analysis_completed_at`, and `analysis_attempts`, plus a
unique `analysis_jobs` table keyed to each interaction. A deterministic
`briefs_interaction_id_unique_idx` prevents duplicate successful briefs on the
same interaction. The worker uses a server-only `SUPABASE_SERVICE_ROLE_KEY` to
read and write database records, never the caller JWT, and validates the
account/interaction link before processing. Users can retry only their own
failed interaction through a server action; retries reset the interaction back
to `queued`, increment the job attempts, and leave completed interactions alone
unless a deliberate retry is requested.

The worker handles Session 7 historical retrieval in the background before
analysis, persists the brief and extracted items idempotently, and records
failure state without deleting the interaction. If an embedding or retrieval
step fails, the job stays retryable and the error message is sanitized before
storage. The relationship page polls every few seconds while queued or
analyzing, stops on terminal states, and renders concise failed/retry states.
The temporary synchronous `maxDuration = 60` workaround has been removed from
`apps/web/src/app/relationships/[id]/page.tsx`.

The worker startup command is:

```sh
PYTHONPATH=. python -m apps.api.worker --poll-interval 5
```

Validation includes the async-analysis worker test cases, Python compile checks,
web lint/typecheck/build verification, and the generated shared contract check.

## Session 10 - Hardening and Observability

Session 10 adds the production-ready hardening layer without changing the user
model or weakening the security boundary. Structured FastAPI request logging now
tracks request IDs, endpoint metadata, account and interaction IDs, status code,
and run duration while deliberately omitting raw request text, prompts, JWTs, and
provider secrets from the log payload. The worker emits job-scoped correlation
fields so queued and failed jobs are traceable through the background pipeline.

The Python provider layer gains bounded timeout and retry controls with a small,
environment-configurable fallback model chain. The configured model and any
fallback model are logged as `model_used` only after a successful call, and retry
logic is limited to transient failures instead of repeated indefinite loops.

The web app includes a minimal, environment-driven Sentry setup that is disabled
cleanly when no DSN is configured, and the Next.js app also adds conservative
security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
Permissions-Policy, and HSTS in production). Plausible is included only when a
configured domain is present; no relationship names, customer text, or IDs are
sent in the analytics payload.

The API CORS policy is explicit and environment-based rather than wildcard with
credentials. The FastAPI app also adds a lightweight `/ready` endpoint for config
sanity checks, while `/health` remains a safe process-status check. Session 10
adds an operations runbook covering backups, worker incidents, embedding
provider outages, and a rollback/deployment plan.

This session intentionally does not add migration changes, does not weaken RLS,
and does not expose service-role or provider secrets to browser-side code. The
repository remains on the safe baseline while preparing for safer production
operations and clearer incident response.

## Beta Hardening - Worker Security + Operations

This beta-hardening pass focuses on the privileged async worker path: the worker
uses the Supabase service-role key and therefore must treat all inbound job data
as untrusted. The main threat model is a cross-account mismatch or stale job that
attempts to process an interaction outside the job's declared account boundary.

The worker now defensively rejects mismatched `job.account_id` versus
`interaction.account_id` before any analysis, retrieval, or provider call is made,
marks the job itself as failed while leaving the mismatched interaction untouched,
and keeps all logging sanitized. This preserves the trust boundary without
changing the user-facing product flow or the database write targets.

The retry/idempotency posture remains conservative: the unique brief-per-
interaction index remains the authoritative guardrail, duplicate job rows are not
created by the retry path, and attempt history is preserved rather than reset.
The queue remains best-effort and retryable for transient provider failures, while
embedding failures remain non-blocking for the brief generation path.

The systemd example unit at `deploy/systemd/relationship-worker.service` uses a
service account and `EnvironmentFile` instead of hardcoded secrets, with restart
policy set to `Restart=always` and a short delay. The stale-job monitor at
`scripts/check_stale_analysis_jobs.py` reads only the real `analysis_jobs` schema
fields (`id`, `status`, `created_at`, `started_at`, `attempts`), exits nonzero on
stale rows, and can be used by cron / n8n / Telegram monitors without creating a
new notification service.

The authenticated Q&A endpoint `/relationships/{account_id}/ask` is already
covered by the same per-user rate-limit mechanism as `/analyze`: 30 requests per
60-minute window, with `Retry-After` returned when the user exceeds the limit.
This is documented and covered by a regression test.

Validation performed in this session includes the worker regression suite, the
API rate-limit regression, Python compile checks, generated shared types check,
web lint/typecheck/build validation, and a git diff sanity pass. Live/manual
acceptance remains required for a real malicious mismatch run, worker kill/restart
recovery, queue-drain validation, and stale-job alert verification in a safe test
environment.
