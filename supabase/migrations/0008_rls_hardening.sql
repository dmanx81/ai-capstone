-- Relia production hardening (forward-only).
-- Does not rewrite 0001–0007. Safe on an empty database after those migrations.
-- Does NOT enable FORCE ROW LEVEL SECURITY. The FastAPI DATABASE_URL role
-- (typically postgres / table owner) continues to bypass RLS; application
-- queries still filter by org_id. RLS applies to anon / authenticated
-- PostgREST roles.

-- ---------------------------------------------------------------------------
-- Indexes for FKs and common relationship / RAG lookups
-- ---------------------------------------------------------------------------
create index if not exists contacts_org_idx on public.contacts(org_id);
create index if not exists risks_org_account_idx on public.risks(org_id, account_id);
create index if not exists opportunities_org_account_idx on public.opportunities(org_id, account_id);
create index if not exists commitments_org_account_idx on public.commitments(org_id, account_id);
create index if not exists tasks_org_account_idx on public.tasks(org_id, account_id);
create index if not exists documents_org_account_idx on public.documents(org_id, account_id);
create index if not exists chunks_source_idx on public.chunks(org_id, source_type, source_id);
create index if not exists briefs_org_account_idx on public.account_briefs(org_id, account_id, created_at desc);
create index if not exists agent_runs_org_account_idx on public.agent_runs(org_id, account_id);
create index if not exists ai_usage_org_idx on public.ai_usage_events(org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Privileged helpers: SECURITY DEFINER, fixed search_path, not granted to anon
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_org_id uuid,
  match_account_id uuid default null,
  match_count integer default 8,
  min_similarity double precision default 0.2
)
returns table (
  id uuid,
  account_id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.account_id,
    c.source_type,
    c.source_id,
    c.content,
    c.extra as metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.org_id = match_org_id
    and (match_account_id is null or c.account_id = match_account_id)
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Customer-data policies: members can read; viewers cannot write via PostgREST
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'contacts', 'timeline_events', 'risks', 'opportunities',
    'commitments', 'tasks', 'documents', 'chunks'
  ]
  loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format('drop policy if exists %I_member_select on public.%I', t, t);
    execute format('drop policy if exists %I_member_insert on public.%I', t, t);
    execute format('drop policy if exists %I_member_update on public.%I', t, t);
    execute format('drop policy if exists %I_member_delete on public.%I', t, t);
    execute format(
      'create policy %I_member_select on public.%I for select using (public.is_org_member(org_id))',
      t, t
    );
    execute format(
      'create policy %I_member_insert on public.%I for insert with check (public.can_write_org(org_id))',
      t, t
    );
    execute format(
      'create policy %I_member_update on public.%I for update using (public.can_write_org(org_id)) with check (public.can_write_org(org_id))',
      t, t
    );
    execute format(
      'create policy %I_member_delete on public.%I for delete using (public.can_write_org(org_id))',
      t, t
    );
  end loop;
end $$;

-- Briefs / agent runs: any org member (including viewer) may read; writes stay membership-scoped.
-- FastAPI still allows viewers to generate briefs; postgres role bypasses RLS for that path.
drop policy if exists account_briefs_member_all on public.account_briefs;
drop policy if exists agent_runs_member_all on public.agent_runs;
drop policy if exists account_briefs_member_select on public.account_briefs;
drop policy if exists account_briefs_member_write on public.account_briefs;
drop policy if exists agent_runs_member_select on public.agent_runs;
drop policy if exists agent_runs_member_write on public.agent_runs;

create policy account_briefs_member_select on public.account_briefs
  for select using (public.is_org_member(org_id));
create policy account_briefs_member_write on public.account_briefs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy agent_runs_member_select on public.agent_runs
  for select using (public.is_org_member(org_id));
create policy agent_runs_member_write on public.agent_runs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Invitations: members must not list hashed tokens. Owners/admins only.
drop policy if exists invitations_member_select on public.invitations;

-- ---------------------------------------------------------------------------
-- PostgREST roles: Relia does not use a browser Supabase client.
-- anon must not read or write application tables.
-- authenticated is still constrained by RLS (defense in depth).
-- Grants are wrapped so this file also applies on plain Postgres (no anon role).

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
    execute 'alter default privileges in schema public revoke all on tables from anon';
    execute 'alter default privileges in schema public revoke all on functions from anon';
  end if;

  execute 'revoke all on all tables in schema public from public';
  execute 'revoke all on all sequences in schema public from public';
  execute 'revoke all on all functions in schema public from public';

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    execute 'grant usage, select on all sequences in schema public to authenticated';
    execute 'grant execute on function public.is_org_member(uuid) to authenticated';
    execute 'grant execute on function public.can_write_org(uuid) to authenticated';
    begin
      execute 'grant execute on function public.match_chunks(vector, uuid, uuid, integer, double precision) to authenticated';
    exception
      when undefined_function then
        execute 'grant execute on all functions in schema public to authenticated';
    end;
    execute 'alter default privileges in schema public grant select, insert, update, delete on tables to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant all on all tables in schema public to service_role';
    execute 'grant all on all sequences in schema public to service_role';
    execute 'grant all on all functions in schema public to service_role';
  end if;
end $$;

