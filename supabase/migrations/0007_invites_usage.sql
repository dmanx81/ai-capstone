create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token_hash text unique not null,
  invited_by uuid references public.users(id),
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists invitations_org_idx on public.invitations(org_id, status);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id),
  action text not null,
  model text not null,
  success boolean not null default true,
  error text,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;
alter table public.ai_usage_events enable row level security;

create policy invitations_member_select on public.invitations
  for select using (public.is_org_member(org_id));

create policy invitations_admin_write on public.invitations
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = invitations.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy ai_usage_member_all on public.ai_usage_events
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create unique index if not exists invitations_pending_email
  on public.invitations (org_id, email)
  where status = 'pending';
