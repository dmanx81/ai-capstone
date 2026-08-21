import os
import uuid
from dataclasses import dataclass
from typing import Any, Optional

import requests
from openai import OpenAI


EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSION = 1536
CHUNK_SIZE_CHARS = 2_000
CHUNK_OVERLAP_CHARS = 200


@dataclass(frozen=True)
class IngestionResult:
    chunks_created: int


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE_CHARS,
    overlap: int = CHUNK_OVERLAP_CHARS,
) -> list[str]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Interaction text must not be empty")
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("Chunk size and overlap are invalid")

    normalized = text.strip()
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(normalized):
            break
        start = end - overlap
    return chunks


def get_embedding_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is missing")
    return OpenAI(
        api_key=api_key,
        base_url=os.getenv("EMBEDDING_BASE_URL", "https://api.openai.com/v1"),
    )


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not chunks:
        return []
    response = get_embedding_client().embeddings.create(
        model=EMBEDDING_MODEL,
        input=chunks,
    )
    ordered_data = sorted(response.data, key=lambda item: item.index)
    embeddings = [list(item.embedding) for item in ordered_data]
    if len(embeddings) != len(chunks):
        raise ValueError("Embedding response count does not match chunk count")
    if any(len(embedding) != EMBEDDING_DIMENSION for embedding in embeddings):
        raise ValueError("Embedding response has an invalid vector dimension")
    return embeddings


def _validate_identifiers(account_id: str, interaction_id: str) -> None:
    try:
        uuid.UUID(account_id)
        uuid.UUID(interaction_id)
    except (AttributeError, ValueError, TypeError) as error:
        raise ValueError("Account and interaction IDs must be valid UUIDs") from error


def persist_chunks(
    account_id: str,
    interaction_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
    bearer_token: str,
    api_key: Optional[str] = None,
) -> IngestionResult:
    _validate_identifiers(account_id, interaction_id)
    if not bearer_token:
        raise ValueError("Caller JWT is required")
    if len(chunks) != len(embeddings):
        raise ValueError("Chunk and embedding counts do not match")
    if any(len(embedding) != EMBEDDING_DIMENSION for embedding in embeddings):
        raise ValueError("Embedding has an invalid vector dimension")

    supabase_url = os.getenv("SUPABASE_URL")
    publishable_key = api_key or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not supabase_url or not publishable_key:
        raise ValueError("Supabase URL and publishable key are required")

    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {bearer_token}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/chunks"
    filters = {
        "account_id": f"eq.{account_id}",
        "interaction_id": f"eq.{interaction_id}",
    }
    delete_response = requests.delete(endpoint, headers=headers, params=filters, timeout=15)
    delete_response.raise_for_status()

    rows: list[dict[str, Any]] = [
        {
            "account_id": account_id,
            "interaction_id": interaction_id,
            "chunk_index": chunk_index,
            "content": chunk,
            "embedding": embedding,
        }
        for chunk_index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    if rows:
        insert_response = requests.post(
            endpoint,
            headers=headers,
            json=rows,
            timeout=30,
        )
        insert_response.raise_for_status()
    return IngestionResult(chunks_created=len(rows))


def ingest_interaction_memory(
    account_id: str,
    interaction_id: str,
    raw_text: str,
    caller_jwt: str,
) -> IngestionResult:
    _validate_identifiers(account_id, interaction_id)
    chunks = chunk_text(raw_text)
    embeddings = embed_chunks(chunks)
    return persist_chunks(account_id, interaction_id, chunks, embeddings, caller_jwt)