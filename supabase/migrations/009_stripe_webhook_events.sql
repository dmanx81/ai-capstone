create table if not exists public.stripe_webhook_events (
    stripe_event_id text primary key,
    event_type text not null,
    status text not null default 'processing'
        check (status in ('processing', 'completed', 'failed')),
    created_at timestamptz not null default now(),
    claimed_at timestamptz not null default now(),
    processed_at timestamptz,
    last_error text
);

alter table public.stripe_webhook_events enable row level security;
-- No policies at all: authenticated/anon get zero access by default-deny;
-- service_role bypasses RLS as always. Only the trusted webhook handler
-- (via claim_stripe_webhook_event below) ever touches this table.

-- Idempotency is "claimed" vs "processed", not a single insert-and-skip:
-- if a claim succeeds but the billing mutation that follows it fails, the
-- event must remain retryable, not silently treated as already handled.
-- This mirrors claim_next_analysis_job() in 007_async_analysis.sql (atomic
-- claim via `for update skip locked`, security definer, service_role only).
create or replace function public.claim_stripe_webhook_event(
    p_stripe_event_id text,
    p_event_type text
)
returns table (claimed boolean, already_completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_inserted_id text;
    v_row record;
begin
    -- First-ever delivery for this event id: the INSERT itself is the atomic
    -- claim. RETURNING lets us tell "I just created this row" apart from
    -- "it already existed" -- without that distinction, this invocation's own
    -- fresh claimed_at would otherwise look identical to a concurrent
    -- in-flight claim in the branch below and be wrongly rejected.
    insert into public.stripe_webhook_events (stripe_event_id, event_type, status, claimed_at)
    values (p_stripe_event_id, p_event_type, 'processing', now())
    on conflict (stripe_event_id) do nothing
    returning stripe_event_id into v_inserted_id;

    if v_inserted_id is not null then
        return query select true, false;
        return;
    end if;

    -- Event already existed: inspect/lock its current state.
    select * into v_row
    from public.stripe_webhook_events
    where stripe_event_id = p_stripe_event_id
    for update skip locked;

    if v_row is null then
        return query select false, false;   -- another delivery holds it right now
        return;
    end if;

    if v_row.status = 'completed' then
        return query select false, true;
        return;
    end if;

    if v_row.status = 'processing' and v_row.claimed_at > now() - interval '2 minutes' then
        return query select false, false;   -- fresh in-flight claim elsewhere
        return;
    end if;

    -- status = 'failed', or an abandoned/stale 'processing' row: reclaim.
    update public.stripe_webhook_events
    set status = 'processing', event_type = p_event_type, claimed_at = now(), last_error = null
    where stripe_event_id = p_stripe_event_id;

    return query select true, false;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text) from public;
revoke execute on function public.claim_stripe_webhook_event(text, text) from anon;
revoke execute on function public.claim_stripe_webhook_event(text, text) from authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;
