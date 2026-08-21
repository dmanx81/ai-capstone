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

The portfolio now reads from the `portfolio_overview` security-invoker view
created in `supabase/migrations/005_portfolio_overview.sql`. The view aggregates
one row per owned relationship with latest and previous non-null health scores,
the most recent `interactions.occurred_at`, and open `risk`/`action` counts.
The authenticated Supabase client makes one dashboard data round trip; all
sorting and KPI derivation happens on the already-fetched dataset.

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
