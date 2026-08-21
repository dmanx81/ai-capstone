# Customer / Relationship Intelligence Platform

This repository contains the v2 Customer / Relationship Intelligence Platform.
It is a Next.js web application backed by Supabase authentication and RLS,
with a FastAPI analysis service that validates structured LLM output.

## Repository Layout

- `apps/web/` - authenticated Next.js relationship interface
- `apps/api/` - JWT-protected FastAPI `/analyze` service
- `packages/shared/` - generated TypeScript types from the Pydantic schema
- `supabase/migrations/` - numbered database schema and RLS migrations
- `scripts/` - development and generated-artifact tooling
- `legacy/streamlit_app.py` - retained v1 reference UI

The active API entrypoint is `apps.api.api:app`. Run it with:

```sh
uvicorn apps.api.api:app --host 0.0.0.0 --port 8000
```

For background analysis processing, run the durable worker separately:

```sh
PYTHONPATH=. python -m apps.api.worker --poll-interval 5
```

The web app is under `apps/web/`:

```sh
cd apps/web
npm install
npm run dev
```

## Configuration

The API requires `SUPABASE_URL` and uses `OPENROUTER_API_KEY` and
`MODEL_NAME` for analysis configuration. The web app requires these server or
public environment variables as appropriate:

- `API_BASE_URL` - URL of the FastAPI service
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `OPENAI_API_KEY` - API-side key for `text-embedding-3-small`
- `EMBEDDING_BASE_URL` - optional OpenAI-compatible embeddings endpoint
- `EMBEDDING_MODEL` - optional embeddings model, defaulting to `text-embedding-3-small`
- `SUPABASE_PUBLISHABLE_KEY` - publishable Supabase key for caller-scoped API writes
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key

Billing (Stripe **test mode** only; see `apps/api/BILLING.md` for the full
design and the manual acceptance checklist — production billing is not
verified until that checklist and live-mode configuration are completed):

- `STRIPE_SECRET_KEY` - server-side Stripe API key (test mode, API process only)
- `STRIPE_WEBHOOK_SECRET` - signing secret for `POST /billing/webhook`
- `STRIPE_PRO_PRICE_ID` - the one recurring Price id Checkout is allowed to sell
- `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` - Checkout redirect targets
- `STRIPE_PORTAL_RETURN_URL` - Customer Portal redirect target

No Stripe publishable key is needed — Checkout and the Customer Portal are
Stripe-hosted redirects, not client-side Stripe.js, so no Stripe code or
secret ever reaches the web app.

Production deployments must configure these values in the hosting platform
environment settings. Never commit `.env` files or service-role credentials.

## Preserved v1 Snapshot

The graded v1 application is preserved at:

- branch: `v1-capstone`
- tag: `v1-graded`

Both point to the v1 snapshot that preceded the v2 monorepo migration.