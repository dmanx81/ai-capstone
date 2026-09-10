# Relia MVP baseline

Locked 2026-09-10 after verification. Do not rewrite these features; extend them.

## Verified

- Demo workspace: Northstar Customer Success (7 accounts)
- CRM: accounts, contacts, health, ARR, lifecycle, tags
- Timeline: chronological system of record with search/filter
- Intelligence: risks, opportunities, commitments, tasks with evidence
- AI brief + RAG grounded in stored records
- Dashboard prioritization
- Agent workflows with confirmation for writes
- Auth, organizations, roles, settings
- Stripe-ready billing with demo fallback
- Supabase migrations: pgvector, `match_chunks`, RLS
- 14 API tests, lint, TypeScript, production build
- Organization isolation
- Service-role, Stripe, and LLM secrets stay server-side

## Demo

`demo@relia.app` / `demo-password`

Commits: `d1fa988` (platform), `1f52453` (session/button polish).
