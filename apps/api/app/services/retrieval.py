from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.ai.embeddings import cosine, get_embedder
from app.models import Chunk

TOKEN = re.compile(r"[a-z0-9]+")


@dataclass
class MatchedChunk:
    id: str
    account_id: str
    source_type: str
    source_id: str
    content: str
    extra: dict
    similarity: float


def _keyword_score(query: str, content: str) -> float:
    q = set(TOKEN.findall((query or "").lower()))
    c = set(TOKEN.findall((content or "").lower()))
    if not q:
        return 0.0
    return len(q & c) / len(q)


def match_chunks(
    db: Session,
    *,
    org_id: str,
    query: str,
    account_id: str | None = None,
    match_count: int = 8,
    min_similarity: float = 0.08,
) -> list[MatchedChunk]:
    """Python equivalent of Postgres `match_chunks`, with a lexical boost for CRM terms."""
    try:
        query_vec = get_embedder().embed([query])[0]
    except Exception:
        query_vec = []
    q = db.query(Chunk).filter(Chunk.org_id == org_id)
    if account_id:
        q = q.filter(Chunk.account_id == account_id)
    ranked: list[MatchedChunk] = []
    for row in q.all():
        sim = cosine(query_vec, row.embedding or []) if query_vec else 0.0
        lexical = _keyword_score(query, row.content)
        score = round((0.7 * sim) + (0.3 * lexical), 4)
        if score >= min_similarity or lexical >= 0.25:
            ranked.append(
                MatchedChunk(
                    id=row.id,
                    account_id=row.account_id,
                    source_type=row.source_type,
                    source_id=row.source_id,
                    content=row.content,
                    extra=row.extra or {},
                    similarity=score,
                )
            )
    ranked.sort(key=lambda item: item.similarity, reverse=True)
    return ranked[:match_count]
