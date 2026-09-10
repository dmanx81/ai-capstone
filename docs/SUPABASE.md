# Production Supabase for Relia

Relia’s browser never talks to Supabase. Next.js proxies `/api/v1/*` to FastAPI. FastAPI uses SQLAlchemy against Postgres (`DATABASE_URL`). Row Level Security in these migrations is defense in depth for PostgREST (`anon` / `authenticated`). The API’s database role is typically the table owner and **bypasses RLS**; every Relia query still filters by `org_id`.

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, or the database password in `NEXT_PUBLIC_*` variables or in git.

## What Relia uses today

| Piece | Used? | Where |
|---|---|---|
| Postgres (`DATABASE_URL`) | Yes, production | API only |
| `SUPABASE_URL` | Optional | API, JWT verification helper |
| `SUPABASE_ANON_KEY` | Optional | API only — **not** in the Next.js bundle |
| `SUPABASE_JWT_SECRET` | Optional | API, if you accept Supabase Auth bearer tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not used in code** | If you set it, keep it on the API host only |
| Supabase Storage | No | Documents are files on the API disk (`UPLOAD_DIR`) |
| Browser Supabase client | No | Do not add `NEXT_PUBLIC_SUPABASE_*` in this phase |

## Demo seed vs production init

| Mode | What happens |
|---|---|
| `APP_ENV=development` and `SEED_DEMO=true` | API inserts the Northstar demo workspace (`demo@relia.app`) and the isolated workspace |
| `APP_ENV=production` | Seed is skipped and refused. The first real workspace is created through `/signup` |

Never rely on demo users in production.

## Create the project

1. In the Supabase dashboard, **New project**.
2. Choose a production region close to the API host. Do not use a hobby project you will throw away.
3. Set a strong database password and store it in a secret manager — not in the repo.
4. Wait until the project is healthy.

## Keys (no real values in git)

From **Project Settings → API**:

- Project URL → `SUPABASE_URL` (API)
- `anon` `public` key → `SUPABASE_ANON_KEY` (API only; Relia does not put this in the browser today)
- `service_role` key → **do not put in Next.js**. Relia does not call the service role. Leave unset unless you have a server job that needs it later.
- JWT Secret → `SUPABASE_JWT_SECRET` (API only, only if you will verify Supabase Auth JWTs)

From **Project Settings → Database**:

- Connection string (pooler, port **6543**, SQLAlchemy form):
  `postgresql+psycopg://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`

Use the **transaction pooler** for the API. Direct connections (port 5432) are for migrations if the pooler rejects `CREATE INDEX CONCURRENTLY` (Relia migrations do not use that).

## Environment on the API host

Required:

```
APP_ENV=production
SEED_DEMO=false
COOKIE_SECURE=true
JWT_SECRET=<at least 32 random characters, unique to this environment>
DATABASE_URL=postgresql+psycopg://...
FRONTEND_ORIGIN=https://<your-web-origin>
CORS_ORIGINS=https://<your-web-origin>
```

Optional:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_JWT_SECRET=<jwt secret>
SUPABASE_SERVICE_ROLE_KEY=   # leave empty unless a future server job needs it
```

On the Next.js host:

```
API_INTERNAL_URL=https://<api-host>
```

Do not set `NEXT_PUBLIC_API_URL`. Analytics may use `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` only.

The API refuses to boot in production if `JWT_SECRET` is the sample value, `DATABASE_URL` is SQLite, `COOKIE_SECURE` is false, or `SEED_DEMO` is true.

## Run migrations

In the SQL editor (or `supabase db push` from this repo), apply **in order**:

1. `supabase/migrations/0001_extensions.sql` — `pgcrypto`, `vector`, `pg_trgm`
2. `0002_orgs.sql` — users, organizations, memberships
3. `0003_crm.sql` — accounts, contacts
4. `0004_intelligence.sql` — timeline, risks, opportunities, commitments, tasks
5. `0005_rag.sql` — documents, chunks, briefs, agent_runs, `match_chunks`
6. `0006_rls.sql` — enable RLS + membership helper
7. `0007_invites_usage.sql` — invitations, AI usage events
8. `0008_rls_hardening.sql` — indexes, viewer write split, anon revoke, `search_path` on functions

An empty project is enough. Migrations do not insert demo rows.

Confirm vector:

```sql
select extname from pg_extension where extname in ('vector', 'pgcrypto', 'pg_trgm');
```

Confirm `match_chunks`:

```sql
select proname, prosecdef, proconfig
from pg_proc
where proname in ('match_chunks', 'is_org_member', 'can_write_org');
```

## Authentication URLs

Relia issues its own HttpOnly cookie (`relia_session`) from `/api/v1/auth/register` and `/login`. You do **not** have to enable Supabase Auth for launch.

If you later enable Supabase Auth (not this phase):

- Site URL = `FRONTEND_ORIGIN`
- Redirect URLs = `FRONTEND_ORIGIN/**`
- FastAPI will accept a Supabase bearer token only when `SUPABASE_JWT_SECRET` is set

Do not change Relia cookie auth without an explicit follow-up.

## First workspace / admin

1. Deploy API + web with the production env above.
2. Open `https://<web>/signup`.
3. Create the first user and workspace. That user is the **owner**.
4. Invite teammates from Settings (owners/admins only).

Do not run `seed_demo` against production.

## RLS verification

API suite (always, uses SQLite locally):

```
pnpm test
```

That includes `apps/api/tests/test_isolation.py` (org A vs org B, header spoofing, RAG, invites, viewer vs member).

Against **this** Supabase project, in the SQL editor:

1. `supabase/verify_rls.sql` — catalog: RLS enabled, anon has no table grants, function `search_path`
2. Optional: `supabase/verify_rls_tenants.sql` — two-tenant probe under `authenticated`, then **ROLLBACK**

Do not claim the live project is verified until those SQL scripts have been run on that project.

## Application health

```
GET https://<api-host>/health
GET https://<api-host>/api/v1/health
GET https://<web-origin>/login
```

Then sign in with the owner you created (not the demo user).

## Dashboard actions (manual)

- Confirm **Data API** settings: Relia does not need browser access to tables. Keep using RLS; `0008` revokes `anon`.
- Do not disable RLS.
- Do not expose `service_role` in a client.
- Storage buckets are unused; leave Storage empty unless you add it later.
- Auth providers can stay disabled for cookie-based Relia auth.

## Service-role policy

Relia source code does **not** read `SUPABASE_SERVICE_ROLE_KEY`. If you set it:

- API process environment only
- never log it
- never send it to Next.js or the browser
- any future privileged call must check `org_id` membership in application code first
