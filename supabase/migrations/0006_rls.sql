-- Row Level Security: organization membership is the tenancy boundary.
-- The FastAPI service uses the user JWT (never the service role in the browser).
-- Policies allow a member to read/write only rows whose org_id they belong to.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.timeline_events enable row level security;
alter table public.risks enable row level security;
alter table public.opportunities enable row level security;
alter table public.commitments enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.account_briefs enable row level security;
alter table public.agent_runs enable row level security;

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

create policy users_self on public.users
  for select using (id = auth.uid());

create policy users_update_self on public.users
  for update using (id = auth.uid());

create policy orgs_member_select on public.organizations
  for select using (public.is_org_member(id));

create policy orgs_owner_update on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

create policy members_select on public.organization_members
  for select using (public.is_org_member(org_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'contacts', 'timeline_events', 'risks', 'opportunities',
    'commitments', 'tasks', 'documents', 'chunks', 'account_briefs', 'agent_runs'
  ]
  loop
    execute format('create policy %I_member_all on public.%I for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));', t, t);
  end loop;
end $$;
