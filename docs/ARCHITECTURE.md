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
- **Timeline events** are the chronological system of record. User-entered types (meeting, email, call, note, customer request, product issue, renewal) can be created, edited, and deleted from the relationship page. System/AI-linked types are not silently editable.
- **Risks / opportunities / commitments / tasks** are structured intelligence objects; creating them also appends a timeline entry
- **Invitations** are org-scoped, hashed-token records. Role assignment is enforced on the API (`viewer` is read-only; only owner/admin can invite).
- **Chunks** store embeddings for notes, CRM snapshots, timeline, documents, and intelligence objects. Re-index with `POST /accounts/{id}/reindex`. Duplicate source text is skipped by content hash; embedding failures keep the previous chunks.

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
- Generation: OpenAI or Anthropic JSON completions when keyed, with timeout + retries; otherwise a grounded assembler that only uses database records
- `match_chunks` exists as SQL (pgvector cosine) and as a Python equivalent for SQLite (hybrid cosine + lexical)
- Answers always return evidence and source references. Missing evidence produces an explicit “will not guess” response
- AI actions log `ai_usage_events` (model, latency, success)

## Agent actions

## Agent actions

`POST /api/v1/accounts/{id}/agents` with `confirm=false` returns a preview. Writes (creating tasks) happen only when `confirm=true` and `apply_writes=true`.

## Billing

Plans in `app/config.py` (`free`, `starter`, `growth`) gate account count and monthly AI actions. Stripe Checkout + Customer Portal are used when `STRIPE_SECRET_KEY` is set. Webhooks verify the Stripe signature and map **price IDs** to plans. The browser cannot set subscription state. Without keys, `/billing/demo-activate` updates the organization locally.

## Frontend routes

| Path | Purpose |
|------|---------|
| `/` | Marketing landing |
| `/product` | Product, workflow, AI, in-product preview |
| `/use-cases` | Customer Success, Account Management, Sales, Leadership |
| `/pricing` | Free / Starter / Growth |
| `/security` | Tenancy, RLS, roles, secrets |
| `/privacy`, `/terms` | Public legal/product documentation |
| `/login`, `/signup`, `/onboarding`, `/invite/[token]` | Auth and invitations |
| `/dashboard` | “What should I focus on today?” |
| `/accounts`, `/accounts/new`, `/accounts/[id]` | CRM + timeline + intelligence |
| `/tasks` | Cross-account next actions |
| `/settings`, `/settings/billing` | Profile, members, invitations, plan |
