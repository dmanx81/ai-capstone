alter table public.chunks
    add column chunk_index integer;

with numbered_chunks as (
    select
        id,
        row_number() over (
            partition by interaction_id
            order by created_at, id
        ) - 1 as chunk_index
    from public.chunks
)
update public.chunks c
set chunk_index = numbered_chunks.chunk_index
from numbered_chunks
where c.id = numbered_chunks.id;

alter table public.chunks
    alter column chunk_index set not null,
    add constraint chunks_chunk_index_check check (chunk_index >= 0),
    add constraint chunks_interaction_chunk_index_key
        unique (interaction_id, chunk_index);

create index chunks_embedding_hnsw_idx
    on public.chunks
    using hnsw (embedding vector_cosine_ops)
    where embedding is not null;