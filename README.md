# Relia

Relia is a relationship intelligence platform for account managers, customer success managers, and account executives.

It answers:

- What is happening with this account?
- What changed recently?
- What risks and opportunities exist?
- What promises were made?
- What should I do next?
- What should I know before the next customer meeting?

The relationship (the **account**) is the system of record. The timeline, stakeholders, and intelligence objects feed grounded AI briefs and RAG answers. Relia does not invent customer facts.

## Architecture

- **Frontend:** Next.js App Router, TypeScript (strict), Tailwind, shadcn/ui — `apps/web`
- **Backend:** FastAPI — `apps/api`
- **Data:** SQLAlchemy locally (SQLite by default). Production schema + RLS + pgvector live in `supabase/migrations`
- **Auth:** HttpOnly session cookie issued by the API (local users table). Optional Supabase JWT verification when `SUPABASE_JWT_SECRET` is set
- **AI:** Provider-neutral embeddings + LLM adapters. Without API keys, briefs and answers are assembled only from stored records
- **Billing:** Stripe Checkout + webhooks when keys are present; otherwise a local demo upgrade
- **Invites:** Owners/admins invite members; Resend when configured, otherwise a shareable link

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEPLOY.md](docs/DEPLOY.md), and the takeover audit in [docs/AUDIT.md](docs/AUDIT.md).

## Demo

```
email:    demo@relia.app
password: demo-password
```

The demo workspace (Northstar Customer Success) is seeded with seven accounts, stakeholders, risks, opportunities, commitments, and a timeline.

Public marketing pages: `/`, `/product`, `/use-cases`, `/pricing`, `/security`, `/privacy`, `/terms`. App login is `/login`; new workspaces start at `/signup`. Explore the demo from the homepage (the sign-in form is prefilled) — credentials are not shown in the hero.

A second user `isolated@example.com` / `isolation-test` exists so organization isolation can be verified.

## Local development

### Requirements

- Node 22+, pnpm
- Python 3.12+
- Optional: Postgres / Supabase, OpenAI or Anthropic keys, Stripe keys

### Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements-dev.txt

pnpm install
cp .env.example .env
```

### Run

Terminal 1 — API on port **43181**:

```bash
pnpm dev:api
```

Terminal 2 — web on port **43180**:

```bash
pnpm dev:web
```

Open [http://127.0.0.1:43180](http://127.0.0.1:43180) and sign in with the demo user.

The Next.js app proxies `/api/v1/*` to FastAPI so the browser never talks to the API origin directly and never receives service-role credentials.

### Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Environment variables

Documented in `.env.example`. Secrets (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, model API keys) belong only on the API / server. Do not prefix them with `NEXT_PUBLIC_`.

## Production

Follow [docs/DEPLOY.md](docs/DEPLOY.md). In short:

1. Provision a Supabase project. Run `supabase/migrations/*.sql` in order (includes `match_chunks`, RLS, invitations).
2. Set `DATABASE_URL` to the Postgres connection string (SQLAlchemy `postgresql+psycopg://` form).
3. Set `JWT_SECRET` or `SUPABASE_JWT_SECRET`, plus `FRONTEND_ORIGIN`. Set `APP_ENV=production` so demo seed does not run.
4. Host FastAPI (Fly, Render, Cloud Run, …) and point `API_INTERNAL_URL` at it for the Next.js server.
5. Host the Next.js app (Vercel is supported for the frontend).
6. Point Stripe webhooks at `https://<api-host>/api/v1/billing/webhook`.
7. Optionally set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for LLM-polished briefs. Retrieval still requires stored evidence.
8. Optionally set `RESEND_API_KEY` so invitations are emailed.

Do not put service-role, Stripe secret, or model keys in `NEXT_PUBLIC_*` variables.

## Security notes

- Row Level Security policies in Supabase treat organization membership as the tenancy boundary
- The API also filters every query by `org_id` from the session
- `password_hash` is never returned in API payloads
- Agent workflows that create tasks require an explicit confirm step
