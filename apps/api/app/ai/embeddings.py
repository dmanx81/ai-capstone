from __future__ import annotations

import hashlib
import re
from typing import Protocol

import numpy as np

from app.config import get_settings

TOKEN = re.compile(r"[a-z0-9]+")
settings = get_settings()


class EmbeddingProvider(Protocol):
    name: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class HashingEmbedding:
    name = "hashing"

    def __init__(self, dim: int | None = None) -> None:
        self.dim = dim or settings.embedding_dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(text) for text in texts]

    def _one(self, text: str) -> list[float]:
        vec = np.zeros(self.dim, dtype=np.float32)
        tokens = TOKEN.findall((text or "").lower())
        if not tokens:
            return vec.tolist()
        for tok in tokens:
            digest = hashlib.blake2b(tok.encode("utf-8"), digest_size=8).digest()
            idx = int.from_bytes(digest[:4], "little") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[idx] += sign
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec /= norm
        return vec.tolist()


class OpenAIEmbedding:
    name = "openai"

    def embed(self, texts: list[str]) -> list[list[float]]:
        import httpx

        response = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": settings.openai_embedding_model, "input": texts},
            timeout=45.0,
        )
        response.raise_for_status()
        data = response.json()["data"]
        data.sort(key=lambda row: row["index"])
        return [row["embedding"] for row in data]


def get_embedder() -> EmbeddingProvider:
    if settings.embedding_provider == "openai":
        return OpenAIEmbedding()
    return HashingEmbedding()


def cosine(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
