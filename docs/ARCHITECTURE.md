# Relia architecture

```
Browser (Next.js :43180)
  └── /api/v1/*  (App Router proxy, forwards cookies)
        └── FastAPI (:43181)
              ├── Auth / orgs / billing
              ├── CRM (accounts, contacts)
              ├── Timeline
              ├── Intelligence objects
              ├── RAG + briefs + agent actions
              └── SQLAlchemy
                    ├── SQLite (local default)
                    └── Postgres + pgvector (Supabase in production)
```

## Tenancy

Every business table has `org_id`. The session cookie identifies the user; `X-Organization-Id` or the JWT `org_id` claim selects the workspace. Members cannot read another organization's rows. Production RLS in `supabase/migrations/0006_rls.sql` repeats this rule in the database.

## Relationship model

- **Account** is the customer relationship
- **Contacts** are stakeholders on that account
- **Timeline events** are the chronological system of record
- **Risks / opportunities / commitments / tasks** are structured intelligence objects; creating them also appends a timeline entry
- **Chunks** store embeddings for notes, CRM snapshots, timeline, documents, and intelligence objects

## Health

`app/services/health.py` recomputes a 0–100 score from:

- recency of timeline activity
- open risk severity
- overdue commitments
- lifecycle (onboarding / churn risk / churned)

Labels: healthy ≥ 75, watch ≥ 55, at_risk ≥ 35, else critical.

## AI

`app/ai/embeddings.py` and `app/ai/llm.py` are provider protocols.

- Embeddings: OpenAI `text-embedding-3-small` when keyed, otherwise a 1536-d hashing embedder
- Generation: OpenAI or Anthropic JSON completions when keyed, otherwise a grounded assembler that only uses database records
- `match_chunks` exists as SQL (pgvector cosine) and as a Python equivalent for SQLite
- Answers always return evidence. Missing evidence produces an explicit “will not guess” response

## Agent actions

`POST /api/v1/accounts/{id}/agents` with `confirm=false` returns a preview. Writes (creating tasks) happen only when `confirm=true` and `apply_writes=true`.

## Billing

Plans in `app/config.py` (`free`, `starter`, `growth`) gate account count and monthly AI actions. Stripe Checkout is used when `STRIPE_SECRET_KEY` is set; otherwise `/billing/demo-activate` updates the organization locally.

## Frontend routes

| Path | Purpose |
|------|---------|
| `/` | Product landing |
| `/login`, `/signup`, `/onboarding` | Auth |
| `/dashboard` | Portfolio focus |
| `/accounts`, `/accounts/new`, `/accounts/[id]` | CRM + timeline + intelligence |
| `/tasks` | Cross-account next actions |
| `/settings`, `/settings/billing` | Profile, members, plan |
