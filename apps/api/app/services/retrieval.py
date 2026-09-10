from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.embeddings import cosine, get_embedder
from app.models import Chunk


@dataclass
class MatchedChunk:
    id: str
    account_id: str
    source_type: str
    source_id: str
    content: str
    extra: dict
    similarity: float


def match_chunks(
    db: Session,
    *,
    org_id: str,
    query: str,
    account_id: str | None = None,
    match_count: int = 8,
    min_similarity: float = 0.08,
) -> list[MatchedChunk]:
    """Python equivalent of the Postgres `match_chunks` function (pgvector cosine)."""
    query_vec = get_embedder().embed([query])[0]
    q = db.query(Chunk).filter(Chunk.org_id == org_id)
    if account_id:
        q = q.filter(Chunk.account_id == account_id)
    ranked: list[MatchedChunk] = []
    for row in q.all():
        sim = cosine(query_vec, row.embedding or [])
        if sim >= min_similarity:
            ranked.append(
                MatchedChunk(
                    id=row.id,
                    account_id=row.account_id,
                    source_type=row.source_type,
                    source_id=row.source_id,
                    content=row.content,
                    extra=row.extra or {},
                    similarity=round(sim, 4),
                )
            )
    ranked.sort(key=lambda item: item.similarity, reverse=True)
    return ranked[:match_count]
