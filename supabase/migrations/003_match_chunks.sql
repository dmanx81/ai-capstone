create or replace function public.match_chunks(
    query_embedding extensions.vector(1536),
    match_account_id uuid,
    match_count integer default 5,
    min_date timestamptz default null
)
returns table (
    id uuid,
    account_id uuid,
    interaction_id uuid,
    content text,
    similarity double precision,
    created_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
    select
        c.id,
        c.account_id,
        c.interaction_id,
        c.content,
        1 - (c.embedding <=> query_embedding) as similarity,
        c.created_at
    from public.chunks c
    join public.interactions i
        on i.id = c.interaction_id
    where
        c.account_id = match_account_id
        and c.embedding is not null
        and (
            min_date is null
            or i.occurred_at >= min_date
        )
    order by c.embedding <=> query_embedding
    limit greatest(match_count, 1);
$$;
