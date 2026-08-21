# Billing & entitlement foundation

Pre-Stripe entitlement foundation. No Checkout/Portal exists yet; `user_billing`
rows are read-only from the app's perspective (service_role can write once
Stripe is wired up — see `supabase/migrations/008_billing.sql`).

## Authoritative billable unit

**One unique `interactions.id` whose analysis reaches `analysis_status = 'complete'`,
counted once per billing period.**

Implemented in `billing.count_completed_interactions_for_accounts()`, which
queries `interactions` (not `briefs`) filtered on `analysis_status = eq.complete`.

Why `interactions.analysis_status`, not brief existence:
`worker.persist_brief_and_items()` inserts/updates the `briefs` row *before*
inserting `extracted_items`. If the `extracted_items` insert fails, the brief
row is still committed, but `worker.process_job()` catches the exception and
marks both the job and the interaction `failed` — the interaction never
reaches `complete`. Counting brief rows directly would therefore overcount:
a brief can outlive a failed job. Counting `analysis_status = 'complete'`
avoids this because that transition is the last thing `process_job()` does,
strictly after brief *and* items have both persisted successfully
(`apps/api/worker.py`, end of the success branch of `process_job`).

Consequences of this definition:
- **Failed analysis (provider error, or brief-persisted-but-items-failed) counts
  zero** — `analysis_status` stays `failed`, never reaches `complete`.
- **Retrying an already-complete interaction counts once** — `interactions.id`
  is the primary key; `retryInteractionAnalysis` and the worker update the
  same row in place, they never insert a second `interactions` row for the
  same analysis.
- `usage_count` was removed from `user_billing` — there is no mutable counter
  anywhere that can drift from this definition or be manipulated client-side.

## Period boundary

- **FREE**: UTC calendar month — `[first-of-month 00:00:00 UTC, first-of-next-month
  00:00:00 UTC)`. Deterministic; see `billing._calendar_month_period_utc()`.
- **PRO**: Stripe's `current_period_start` / `current_period_end` on the
  `user_billing` row, when both are present and the subscription is
  active/trialing. Stripe isn't integrated yet, so these columns are always
  null today and PRO falls back to the same UTC calendar month as FREE.
- **Inactive/canceled PRO**: treated as FREE (FREE allowance, FREE period),
  not blocked — see `billing._effective_plan_and_active()`.

## Normal analysis execution path

```
interaction insert (queued) -> analysis_jobs insert (queued)
  -> worker claims job (claim_next_analysis_job RPC, service role)
  -> load interaction, verify interaction.account_id == job.account_id
  -> resolve account owner -> resolve entitlement -> enforce quota
  -> provider call (perform_analysis)
  -> persist_brief_and_items (brief, then extracted_items)
  -> interaction/job marked complete
```

This is the **only** path that may call the provider and consume quota. It is
implemented once, in `worker.py`, and `billing.get_account_entitlement()` /
`billing.enforce_analysis_allowance_for_account()` are the single shared
helper both the worker and any HTTP surface must call — never duplicate quota
logic elsewhere.

`POST /analyze` (a synchronous pre-worker relic) is **deprecated** — it always
returns `410 Gone` after authenticating the caller, before touching the
provider or any billing helper. It predates the async pipeline, never
persisted a `briefs` row or an `analysis_status` transition, so a successful
call there was invisible to `get_user_entitlement()` — an unmetered bypass.
Nothing in this repo calls it; it is kept live only so an external caller
gets an explicit signal instead of a silent 404.

## Worker concurrency model

Entitlement enforcement in `worker.process_job()` is **check-then-act, not
atomic**: it reads the current completed-count, compares to the allowance,
and only then proceeds to the provider call. There is no row lock or
reservation between the check and the eventual `analysis_status = 'complete'`
write.

- **Supported beta topology: exactly one supervised worker process**
  (`deploy/systemd/relationship-worker.service` is a single `Type=simple`
  unit, not a template/pool). Job *claiming* is atomic
  (`claim_next_analysis_job()` uses `for update skip locked`), so two workers
  can never process the same job — but two workers processing two *different*
  interactions for the *same account* concurrently could both pass the quota
  check before either completes, allowing usage to exceed the allowance by
  the number of concurrently-racing workers.
- Under the single-worker topology, jobs are processed strictly one at a
  time, so this race cannot occur in practice.
- **Before running more than one worker process (horizontal scaling),** quota
  enforcement needs an atomic reservation (e.g. a `select ... for update` on
  `user_billing`, or a Postgres function that checks-and-reserves in one
  transaction) — do not scale the worker out without adding that first.

## Stripe test-mode integration

`Next.js server actions -> authenticated FastAPI /billing/* -> Stripe SDK`
(official `stripe` Python package, `apps/api/requirements.txt`). No Stripe
code exists in the web app; Stripe secrets never leave the API process; there
is no card UI — Checkout and the Customer Portal are both Stripe-hosted
redirect flows. **Stripe is billing authority; the Supabase user UUID is
identity authority.** Nothing here changes `_effective_plan_and_active()` or
`get_user_entitlement()` — Stripe only ever writes the same `user_billing`
columns those already read.

### Required environment variables (test mode; not yet populated)

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-side Stripe API key (test mode: `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `POST /billing/webhook` (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | The one recurring Price id Checkout is allowed to sell |
| `STRIPE_SUCCESS_URL` | Where Checkout redirects on success |
| `STRIPE_CANCEL_URL` | Where Checkout redirects on cancel |
| `STRIPE_PORTAL_RETURN_URL` | Where the Customer Portal redirects back to |

No publishable key is needed — Checkout and the Portal are hosted redirects,
not client-side Stripe.js. No price ID is ever hardcoded.

### Checkout flow (`POST /billing/checkout`)

Authenticated (Supabase JWT) only, no request body. The caller cannot choose
a price, plan, amount, or customer id — there is nothing on the endpoint to
supply them with. Server behavior: resolve `user_id` from the JWT ->
`billing.resolve_or_create_stripe_customer()` (reuses `stripe_customer_id`
from `user_billing` if already present, otherwise creates a Stripe Customer
and persists the mapping immediately, before any webhook could possibly fire)
-> `stripe.checkout.Session.create(mode="subscription", price=STRIPE_PRO_PRICE_ID, ...)`
-> return only the hosted `checkout_url`.

### Customer mapping (trust chain)

`accounts`/interactions billing already resolves `account_id -> owner_id ->
user_billing` (see above). Stripe adds one more link, established the moment
a customer is created — **not** deferred to webhook metadata:
`stripe_customer_id -> user_billing.stripe_customer_id -> user_id`. Every
webhook handler resolves the mutation target exclusively through this chain
(`billing.resolve_user_id_for_stripe_customer()`); `event.data.object.metadata`
is never read to decide who gets mutated, anywhere in this codebase. A forged
or mismatched `metadata.user_id` on an incoming event therefore cannot
promote a different account — regression test:
`test_stripe_billing.MetadataDistrustTests`.

### Webhook signature verification (`POST /billing/webhook`)

No Supabase auth dependency (Stripe cannot send a Supabase JWT) and no rate
limiting (not a user action) — the Stripe signature is the entire trust
boundary. The raw request body is read (`await request.body()`) before
anything attempts to parse it as JSON, and verified with the official SDK
only: `stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)`.
No custom HMAC exists anywhere in this codebase. Invalid/missing signature ->
`400`. Missing `STRIPE_WEBHOOK_SECRET` -> `503` — verification is never
skipped, even when unconfigured.

### Webhook idempotency: claim ≠ processed

An earlier draft of this design used a single `INSERT ... ON CONFLICT DO
NOTHING` as the whole idempotency mechanism. That is unsafe: if the insert
succeeds but the billing mutation that follows fails, the event row already
exists, so a genuine Stripe retry would see "already recorded" and skip
forever — silently losing the subscription update. The actual design
(`009_stripe_webhook_events.sql`) is a state machine, not a single insert:

```
signature verification
  -> claim_stripe_webhook_event RPC (insert-or-inspect state machine,
     `for update skip locked`, mirrors claim_next_analysis_job in 007)
  -> idempotent full-state billing mutation (handle_stripe_webhook_event)
  -> mark 'completed' only after that mutation returns without raising
```

`stripe_webhook_events.status` is `processing` / `completed` / `failed`.
`claim_stripe_webhook_event(event_id, event_type)`:
- brand-new event id -> the `INSERT ... ON CONFLICT DO NOTHING RETURNING`
  itself is the claim (distinguished from "already existed" via the
  `RETURNING` value, not by inspecting `status`/`claimed_at` — a just-inserted
  row's own fresh `claimed_at` would otherwise be indistinguishable from a
  concurrent in-flight claim in the next branch) -> `(claimed=true, already_completed=false)`, proceed immediately.
- existing row, `status='completed'` -> `(false, true)` — duplicate, no
  mutation, final `2xx`.
- existing row, `status='processing'` and `claimed_at` within the last **2
  minutes** -> `(false, false)` — another delivery is actively processing it
  right now. The webhook route returns `409` for this (retryable, **not** a
  disguised `2xx`) and performs no mutation.
- existing row, `status='failed'`, or a `processing` row older than the
  2-minute window (covers a crashed attempt that never got to mark itself
  failed) -> reclaimed, `(true, false)`, proceed.

The `for update skip locked` lock only spans the single RPC call — PostgREST
commits per request, so it cannot stay held across the *separate* HTTP
request that performs the actual billing mutation afterward. What actually
prevents two near-simultaneous deliveries from both mutating during that
window is the `status` + `claimed_at` freshness check above, not the lock
itself; the lock only resolves the microsecond-scale race of two RPC calls
landing at the exact same instant. `mark_stripe_webhook_event_completed()`
is called strictly after `handle_stripe_webhook_event()` returns without
raising; a mutation failure calls `mark_stripe_webhook_event_failed()`
instead and returns `503` (Stripe retries). Both mark-functions raise
`BillingServiceError` on their own failure too — safe, because
`apply_subscription_state()` is a full-state upsert, not a delta, so
replaying it on a later retry is harmless. Regression coverage for the exact
claim -> fail -> retry -> succeed -> duplicate sequence, plus the
first-ever-delivery and concurrent-claim branches, lives in
`test_stripe_billing.WebhookRouteTests` / `WebhookMigrationStaticTests`.

No RPC/transaction wraps the billing mutation itself, consistent with how
`analysis_jobs` claiming already works in this codebase: only the narrow
state transition is atomic in SQL; the actual work happens afterward over
ordinary service-role REST calls.

### Subscription reconciliation

`checkout.session.completed`, `customer.subscription.{created,updated,deleted}`
are handled; anything else (including `invoice.payment_failed`) is safely
ignored — `customer.subscription.updated` already carries every status
transition (`past_due`, `unpaid`, `canceled`, ...) this app acts on, so a
separate `invoice.payment_failed` handler would only duplicate that path.
`checkout.session.completed` is deliberately **not** treated as proof of PRO
by itself: the handler re-fetches the canonical `Subscription` via
`stripe.Subscription.retrieve()` (a trusted server-side call, not
payload-trust) rather than reading price/status off the checkout session.

Reconciliation writes the *truthful raw* Stripe state — `stripe_customer_id`,
`stripe_subscription_id`, `stripe_price_id`, `plan` (`"PRO"` iff the price id
equals the configured `STRIPE_PRO_PRICE_ID`, independent of status),
`status` (normalized — see below), `current_period_start`/`current_period_end`
(explicit Unix -> UTC ISO conversion, `datetime.fromtimestamp(ts,
tz=timezone.utc).isoformat()`, never raw Stripe objects into the DB). It
**does not re-derive** active/inactive — `_effective_plan_and_active()`
(unchanged) still makes that call at read time, so a canceled PRO-price
subscription is written truthfully as `plan=PRO, status=canceled` and still
resolves to effective FREE entitlement through the existing, untouched logic.
The rule lives in exactly one place.

Stripe subscription statuses outside `008`'s check constraint
(`incomplete`, `incomplete_expired`, `paused`, and any future addition) are
normalized to `"inactive"` before being written (`_normalize_stripe_status()`)
rather than widening the constraint — `008` is not modified by this session.

### Customer Portal flow (`POST /billing/portal`)

Authenticated, no body. Loads the caller's `user_billing` row, requires a
`stripe_customer_id` to already be present (never accepted from the browser);
if absent, returns a safe `400 no_active_billing_customer` rather than a
generic `503`. Otherwise `stripe.billing_portal.Session.create(customer=...,
return_url=STRIPE_PORTAL_RETURN_URL)`, returning only the hosted URL.

### `GET /billing/status`

Authenticated, returns only `{plan, status, usage_count,
monthly_analysis_allowance, remaining_usage, period_start, period_end}` —
the same shape `get_user_entitlement()` already computes. No Stripe IDs, no
secrets. This is the only way the web app can see usage/period data, since
neither is a stored `user_billing` column — both are derived at read time.

### Q&A quota (unchanged)

This session does not add any quota/billing to `/relationships/{id}/ask`.
The monthly billing limit applies to analyses only; the existing per-user
rate limiter (`enforce_rate_limit`, 30 req/60 min, shared with the deprecated
`/analyze`) is untouched and remains the only control on that endpoint.

## Known limitations

- Quota enforcement is check-then-act (see the Worker concurrency model
  section above) and is only safe under the single-worker topology.
- `POST /analyze` is deprecated but not removed; it still parses/authenticates
  requests before rejecting them.
- `current_period_start`/`current_period_end` are populated by
  `customer.subscription.*`/`checkout.session.completed` webhook events once
  Stripe is configured; until the first such event lands for a given user,
  PRO runs on the FREE calendar-month boundary.
- The webhook's 2-minute stale-`processing` reclaim window assumes no single
  billing mutation legitimately takes longer than that; if `upsert_user_billing_fields`
  or `stripe.Subscription.retrieve` were ever meaningfully slower, a second
  delivery could reclaim and reprocess while the first is still genuinely in
  flight. Not expected at this call's scale (single-row upsert, one Stripe
  API round trip), but noted as a real assumption.
- **Production billing is NOT verified until live-mode configuration and a
  full manual acceptance pass (below) are completed.** Nothing in this
  session has been run against a real Stripe account, real webhook delivery,
  or a real card.

## Manual Stripe test-mode acceptance (not yet executed)

This checklist has **not** been run this session. Required before claiming
the Stripe integration actually works end to end, in Stripe **test mode**:

1. Create a Pro recurring test Price in the Stripe test-mode dashboard.
2. Configure the six env vars above (test-mode secret key, a webhook secret
   from step 3, the test Price id, success/cancel/portal-return URLs).
3. Run `stripe listen --forward-to localhost:8000/billing/webhook` (Stripe
   CLI) to forward test-mode webhook deliveries locally.
4. Log in as a FREE user.
5. Confirm Settings shows FREE plan/status and current usage.
6. Click "Upgrade to Pro".
7. Pay with a Stripe test card on the hosted Checkout page.
8. Return from Checkout back to the app.
9. Confirm the webhook event lands and reconciles PRO (check
   `stripe_webhook_events` and `user_billing` directly, or API logs).
10. Confirm Settings now shows PRO.
11. Confirm the worker recognizes the PRO allowance on the next analysis.
12. Open the Customer Portal from Settings ("Manage subscription").
13. Cancel the subscription in the Portal.
14. Confirm the cancellation webhook fires and reconciles.
15. Confirm Settings falls back to FREE.
16. Confirm the worker enforces the FREE quota again.

No step in this list has been performed. Do not treat the Stripe integration
as production-verified based on this session's code review and unit tests
alone.
