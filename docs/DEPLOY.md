# Production deployment

Do not deploy automatically from this repository. Provision each piece, then cut over.

## Topology

- **Web:** Next.js (`apps/web`) on Vercel or any Node host. It proxies `/api/v1/*` to FastAPI using `API_INTERNAL_URL`.
- **API:** FastAPI (`apps/api`) on Fly, Render, Cloud Run, or similar. Persistent process; not a browser-exposed service-role client.
- **Data:** Supabase Postgres with the SQL in `supabase/migrations/` applied in order.

The browser never receives `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `JWT_SECRET`, or model API keys. Those live on the API (and, for the proxy URL only, the Next.js server).

## 1. Supabase

1. Create a project.
2. Run `supabase/migrations/0001_*.sql` through `0007_*.sql` in the SQL editor (or `supabase db push`).
   - `0001` enables `vector`
   - `0005` creates `chunks` + `match_chunks`
   - `0006` enables RLS
   - `0007` adds invitations and AI usage events
3. Set API `DATABASE_URL` to the SQLAlchemy form:
   `postgresql+psycopg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
4. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET` on the API if you verify Supabase Auth JWTs.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` on the API only, and only if a future server job needs it. Relia does not send it to the client.
6. Set `APP_ENV=production` and `SEED_DEMO=false` so demo accounts are not inserted.

Local development stays on SQLite when `DATABASE_URL` is unset. Demo seed runs only when `SEED_DEMO=true` and `APP_ENV` is not `production`.

## 2. Auth and organizations

- Local/dev: Relia issues an HttpOnly `relia_session` cookie from `/api/v1/auth/register` and `/login`.
- Production: the same cookie still works. If `SUPABASE_JWT_SECRET` is set, incoming Bearer tokens signed by Supabase are accepted and mapped to `users` + `organization_members` by email/`sub`.
- Workspace membership is the tenancy boundary. Every query filters `org_id`. RLS repeats that rule in Postgres.

## 3. Member invitations

Owners and admins invite from Settings. If `RESEND_API_KEY` is set, Relia emails the link. Otherwise the API returns `invite_url` for the admin to copy. Accepting assigns the invited role. Viewers are read-only (enforced on write routes).

## 4. LLM

Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. Structured JSON, timeouts, and retries are configured with `LLM_TIMEOUT_SECONDS` and `LLM_RETRIES`. If keys are missing, briefs and answers still assemble from stored records and never invent customer facts.

## 5. Stripe

1. Create Starter and Growth products/prices.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`.
3. Point the webhook at `https://<api-host>/api/v1/billing/webhook` for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Plan is taken from the Stripe price ID (or Checkout metadata Relia stamped server-side). The client cannot set plan status.
5. If Stripe keys are absent, `/billing/demo-activate` remains available for local development only.

## 6. Hosts

- API: `uvicorn app.main:app --host 0.0.0.0 --port 43181` from `apps/api` with production env.
- Web: `pnpm --filter relia-web build` then `pnpm --filter relia-web start`, or Vercel with `API_INTERNAL_URL` pointing at the API.

Set `FRONTEND_ORIGIN` and `CORS_ORIGINS` to the public web origin. Set `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` to that origin.
