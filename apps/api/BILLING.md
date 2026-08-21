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

## Known pre-Stripe limitations

- `current_period_start`/`current_period_end` are always null until Stripe is
  integrated, so PRO always runs on the FREE calendar-month period boundary
  for now.
- `user_billing` has no authenticated write path (by design — RLS is
  select-own only); there is currently no code path that creates a PRO row at
  all, since Stripe isn't wired up. All accounts are effectively FREE today.
- Quota enforcement is check-then-act (see above) and is only safe under the
  single-worker topology.
- `POST /analyze` is deprecated but not removed; it still parses/authenticates
  requests before rejecting them.
