alter table public.interactions
    add column if not exists analysis_status text not null default 'queued'
        check (analysis_status in ('queued', 'analyzing', 'complete', 'failed')),
    add column if not exists analysis_error text,
    add column if not exists analysis_started_at timestamptz,
    add column if not exists analysis_completed_at timestamptz,
    add column if not exists analysis_attempts integer not null default 0;

create table if not exists public.analysis_jobs (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    interaction_id uuid not null references public.interactions(id) on delete cascade,
    status text not null default 'queued'
        check (status in ('queued', 'analyzing', 'complete', 'failed')),
    attempts integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    unique (interaction_id)
);

create index if not exists analysis_jobs_account_id_idx
    on public.analysis_jobs(account_id);

create index if not exists analysis_jobs_status_idx
    on public.analysis_jobs(status, created_at);

create unique index if not exists briefs_interaction_id_unique_idx
    on public.briefs(interaction_id)
    where interaction_id is not null;

alter table public.analysis_jobs enable row level security;

create policy "analysis_jobs_select_own"
on public.analysis_jobs
for select
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = analysis_jobs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "analysis_jobs_insert_own"
on public.analysis_jobs
for insert
to authenticated
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = analysis_jobs.account_id
        and a.owner_id = (select auth.uid())
    )
    and exists (
        select 1
        from public.interactions i
        where i.id = analysis_jobs.interaction_id
        and i.account_id = analysis_jobs.account_id
    )
);

create policy "analysis_jobs_update_own"
on public.analysis_jobs
for update
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = analysis_jobs.account_id
        and a.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = analysis_jobs.account_id
        and a.owner_id = (select auth.uid())
    )
    and exists (
        select 1
        from public.interactions i
        where i.id = analysis_jobs.interaction_id
        and i.account_id = analysis_jobs.account_id
    )
);

create policy "analysis_jobs_delete_own"
on public.analysis_jobs
for delete
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = analysis_jobs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create or replace function public.claim_next_analysis_job()
returns table (
    id uuid,
    account_id uuid,
    interaction_id uuid,
    status text,
    attempts integer,
    last_error text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with candidate as (
        select j.*
        from public.analysis_jobs j
        where j.status = 'queued'
        order by j.created_at asc, j.id asc
        limit 1
        for update skip locked
    )
    update public.analysis_jobs j
    set
        status = 'analyzing',
        attempts = j.attempts + 1,
        started_at = now(),
        last_error = null,
        completed_at = null
    from candidate
    where j.id = candidate.id
    returning j.id, j.account_id, j.interaction_id, j.status, j.attempts, j.last_error;
end;
$$;

revoke all on function public.claim_next_analysis_job() from public;
revoke execute on function public.claim_next_analysis_job() from anon;
revoke execute on function public.claim_next_analysis_job() from authenticated;
grant execute on function public.claim_next_analysis_job() to service_role;
