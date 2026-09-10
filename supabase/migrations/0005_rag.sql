create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  filename text not null,
  mime_type text,
  storage_path text not null,
  extracted_text text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  content text not null,
  embedding vector(1536),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_org_idx on public.chunks(org_id, account_id);
create index if not exists chunks_embedding_idx on public.chunks using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create table if not exists public.account_briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  content jsonb not null,
  model text not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  action text not null,
  status text not null default 'preview',
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  confirmed boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

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
