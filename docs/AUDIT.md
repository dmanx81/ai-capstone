# Relia — Repository Audit

**Date:** 2026-09-10  
**Auditor:** takeover session on an empty New Project repository  
**Product:** Relia — Relationship Intelligence Platform for AMs, CSMs, and AEs

## Finding

This git repository contained **no application code**. The only commit was `Initialize project` (empty tree). There was no README, no `package.json`, no Python package, no Supabase migrations, no tests, and no deployment configuration.

The product vision, intended architecture, and phased delivery plan in the takeover brief are therefore treated as the **source of truth**, not as a rewrite of a working codebase.

No existing routes, models, Stripe code, RAG pipeline, or dashboard were present to preserve. Implementation follows the stated stack rather than inventing a different one.

---

## 1. What already works

| Area | Status |
|------|--------|
| Git repository | Empty `main` branch only |
| Frontend | Not present |
| Backend | Not present |
| Database / RLS | Not present |
| Auth | Not present |
| AI / RAG | Not present |
| Stripe | Not present |
| Tests | Not present |
| CI / deploy | Not present |

Nothing in the product could be run, linted, type-checked, or built.

## 2. What is partially implemented

Nothing. There were no TODOs, FIXMEs, stubs, or half-finished modules.

## 3. What is missing

All of it, mapped to the intended architecture:

- **Frontend:** Next.js App Router, TypeScript strict, Tailwind, shadcn/ui
- **Backend:** Python FastAPI under `apps/api`
- **Data / auth:** Supabase SQL migrations, PostgreSQL, Auth, RLS, pgvector, `match_chunks`
- **CRM:** accounts, contacts, relationship page
- **Timeline:** unified chronological customer timeline
- **Intelligence objects:** risks, opportunities, commitments, next actions
- **AI:** provider-neutral embeddings, RAG, structured briefs, evidence/confidence
- **Dashboard:** portfolio attention views
- **Agent actions:** focused, confirm-before-write workflows
- **SaaS:** orgs, roles, onboarding, settings, Stripe billing/plans
- **Analytics:** PostHog (optional; not preconfigured)
- **Docs:** README, architecture, env, local/dev/deploy

## 4. Bugs or technical debt

None in-repo (no code). Risks to avoid while building:

- Empty-repo “rewrite” temptation — do not swap the requested stack
- Service-role keys leaking to the browser
- AI hallucination without evidence
- Org isolation only in the UI, not in RLS / query filters

## 5. Security concerns

No running surface yet. Non-negotiables for the build:

- RLS as a security boundary (Supabase SQL) plus server-side org filters
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or Stripe secrets to the client
- Validate all writes in the API
- Ground AI in retrieved/stored evidence; no invented customer facts

## 6. Recommended implementation order

Follow the brief:

1. Scaffold monorepo (`apps/web`, `apps/api`, `supabase/migrations`)
2. Auth + organizations + RLS-equivalent isolation
3. Accounts / contacts / relationship page
4. Timeline
5. Risks / opportunities / commitments / tasks
6. Account intelligence brief
7. RAG (`match_chunks` + grounded Q&A)
8. Portfolio dashboard
9. Agent actions (with confirmation)
10. Settings + Stripe (live keys optional; demo fallback)
11. UI polish
12. Tests, docs, production prep

## Local/runtime notes from the audit environment

- Node 22, pnpm, Python 3.12 available
- Docker / local Postgres / Supabase CLI not assumed
- Therefore: SQLite (or `DATABASE_URL` Postgres) for local demo, plus production Supabase SQL migrations
- AI and Stripe must degrade cleanly without cloud credentials
