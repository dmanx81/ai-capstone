-- Catalog checks for Relia RLS. Run in the Supabase SQL editor as the
-- postgres role AFTER applying migrations 0001–0008.
-- This does not insert tenant data. It does not claim live two-org isolation
-- by itself — use supabase/verify_rls_tenants.sql for that (optional).

do $$
declare
  missing text;
  t text;
  tables text[] := array[
    'users', 'organizations', 'organization_members', 'accounts', 'contacts',
    'timeline_events', 'risks', 'opportunities', 'commitments', 'tasks',
    'documents', 'chunks', 'account_briefs', 'agent_runs', 'invitations',
    'ai_usage_events'
  ];
begin
  foreach t in array tables
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception 'RLS is not enabled on public.%', t;
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'public.accounts', 'select') then
      raise exception 'anon must not SELECT public.accounts';
    end if;
    if has_table_privilege('anon', 'public.chunks', 'select') then
      raise exception 'anon must not SELECT public.chunks';
    end if;
    if has_table_privilege('anon', 'public.invitations', 'select') then
      raise exception 'anon must not SELECT public.invitations';
    end if;
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'match_chunks'
      and p.proconfig is null
  ) then
    raise exception 'match_chunks must set search_path';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_org_member' and p.prosecdef
  ) then
    raise exception 'is_org_member must be SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitations' and policyname = 'invitations_admin_write'
  ) then
    raise exception 'invitations_admin_write policy missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'invitations' and policyname = 'invitations_member_select'
  ) then
    raise exception 'invitations_member_select should have been dropped';
  end if;

  raise notice 'Relia RLS catalog checks passed';
end $$;
