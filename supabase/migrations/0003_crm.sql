create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  lifecycle text not null default 'active',
  owner_id uuid references public.users(id),
  health text not null default 'watch',
  health_score integer not null default 70,
  arr numeric(14,2),
  tags jsonb not null default '[]'::jsonb,
  description text,
  renewal_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_org_idx on public.accounts(org_id);
create index if not exists accounts_name_trgm on public.accounts using gin (name gin_trgm_ops);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  stakeholder_role text not null default 'end_user',
  influence text not null default 'medium',
  sentiment text not null default 'unknown',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_account_idx on public.contacts(account_id);
