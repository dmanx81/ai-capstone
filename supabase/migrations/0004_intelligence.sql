create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  contact_ids jsonb not null default '[]'::jsonb,
  evidence_source text,
  evidence_url text,
  evidence_excerpt text,
  source_object_type text,
  source_object_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists timeline_org_account_idx on public.timeline_events(org_id, account_id, occurred_at desc);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  description text not null,
  severity text not null default 'medium',
  confidence double precision not null default 0.7,
  evidence jsonb not null default '[]'::jsonb,
  owner_id uuid references public.users(id),
  status text not null default 'open',
  detected_at timestamptz not null default now(),
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  description text not null,
  potential_value numeric(14,2),
  confidence double precision not null default 0.6,
  evidence jsonb not null default '[]'::jsonb,
  owner_id uuid references public.users(id),
  status text not null default 'identified',
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  description text not null,
  direction text not null default 'us',
  due_date timestamptz,
  owner_id uuid references public.users(id),
  status text not null default 'open',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  owner_id uuid references public.users(id),
  status text not null default 'open',
  source text not null default 'user',
  rationale text,
  related_object_type text,
  related_object_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
