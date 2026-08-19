create extension if not exists vector
with schema extensions;

create table public.accounts (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    industry text,
    region text,
    renewal_date date,
    created_at timestamptz not null default now()
);

create table public.interactions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    type text not null
        check (type in ('meeting', 'email', 'note', 'transcript')),
    raw_text text not null,
    occurred_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table public.briefs (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    interaction_id uuid references public.interactions(id) on delete set null,
    content_json jsonb not null,
    health_score integer
        check (
            health_score is null
            or health_score between 0 and 100
        ),
    model_used text,
    created_at timestamptz not null default now()
);

create table public.extracted_items (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    brief_id uuid not null references public.briefs(id) on delete cascade,
    kind text not null
        check (kind in ('risk', 'opportunity', 'action')),
    title text not null,
    detail text,
    status text not null default 'open'
        check (status in ('open', 'resolved')),
    due_date date,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create table public.chunks (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    interaction_id uuid not null references public.interactions(id) on delete cascade,
    content text not null,
    embedding extensions.vector(1536),
    created_at timestamptz not null default now()
);

create table public.user_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    preferred_model text,
    output_language text not null default 'en',
    brief_sections jsonb,
    tone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index accounts_owner_id_idx
    on public.accounts(owner_id);

create index interactions_account_id_idx
    on public.interactions(account_id);

create index interactions_occurred_at_idx
    on public.interactions(occurred_at desc);

create index briefs_account_id_idx
    on public.briefs(account_id);

create index extracted_items_account_id_idx
    on public.extracted_items(account_id);

create index extracted_items_status_idx
    on public.extracted_items(status);

create index chunks_account_id_idx
    on public.chunks(account_id);

create index chunks_interaction_id_idx
    on public.chunks(interaction_id);
