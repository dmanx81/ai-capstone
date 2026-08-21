import os
import threading
import time
import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from apps.api.analyzer import (
    analyze_account,
    answer_relationship_question,
    get_configured_model_name,
)
from apps.api.embeddings import ingest_interaction_memory, retrieve_relationship_context
from apps.api.schemas import RelationshipAnswer, RelationshipQuestion, RelationshipSource


SUPABASE_URL = os.environ["SUPABASE_URL"]

SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1"
SUPABASE_JWKS_URL = f"{SUPABASE_ISSUER}/.well-known/jwks.json"

security = HTTPBearer(auto_error=False)
jwks_client = PyJWKClient(SUPABASE_JWKS_URL, timeout=5)

RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
request_timestamps: dict[str, list[float]] = {}
rate_limit_lock = threading.Lock()
logger = logging.getLogger(__name__)


app = FastAPI(
    title="AI Capstone API",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    customer_text: str = Field(min_length=40, max_length=50_000)
    account_id: UUID
    interaction_id: UUID


@dataclass(frozen=True)
class AuthenticatedRequest:
    claims: dict
    bearer_token: str


def enforce_rate_limit(user_id: str) -> None:
    now = time.time()

    with rate_limit_lock:
        timestamps = request_timestamps.get(user_id, [])
        active_timestamps = [
            timestamp
            for timestamp in timestamps
            if now - timestamp < RATE_LIMIT_WINDOW_SECONDS
        ]

        if len(active_timestamps) >= RATE_LIMIT_REQUESTS:
            retry_after = max(
                1,
                int(
                    active_timestamps[0]
                    + RATE_LIMIT_WINDOW_SECONDS
                    - now
                )
                + 1,
            )
            request_timestamps[user_id] = active_timestamps
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(retry_after)},
            )

        active_timestamps.append(now)
        request_timestamps[user_id] = active_timestamps


def verify_supabase_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=SUPABASE_ISSUER,
        )

        if payload.get("role") != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication role",
            )

        return AuthenticatedRequest(claims=payload, bearer_token=token)

    except HTTPException:
        raise

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        )

    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )

    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/analyze")
def analyze(
    request: AnalyzeRequest,
    auth: AuthenticatedRequest = Depends(verify_supabase_token),
):
    claims = auth.claims
    user_id = claims.get("sub")

    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication subject",
        )

    enforce_rate_limit(user_id)

    historical_context = None
    try:
        historical_context = retrieve_relationship_context(
            str(request.account_id),
            request.customer_text,
            auth.bearer_token,
            match_count=3,
        )
        historical_context = [
            chunk
            for chunk in historical_context
            if chunk.interaction_id != str(request.interaction_id)
        ]
    except Exception as error:
        logger.warning(
            "Historical context retrieval failed account_id=%s interaction_id=%s error_category=%s",
            request.account_id,
            request.interaction_id,
            type(error).__name__,
        )

    brief = analyze_account(request.customer_text, historical_context)

    try:
        ingestion = ingest_interaction_memory(
            str(request.account_id),
            str(request.interaction_id),
            request.customer_text,
            auth.bearer_token,
        )
        logger.info(
            "Interaction memory ingestion completed account_id=%s interaction_id=%s chunks=%d",
            request.account_id,
            request.interaction_id,
            ingestion.chunks_created,
        )
    except Exception as error:
        logger.warning(
            "Interaction memory ingestion failed account_id=%s interaction_id=%s error_category=%s",
            request.account_id,
            request.interaction_id,
            type(error).__name__,
        )

    return {
        **brief.model_dump(),
        "model_used": get_configured_model_name(),
    }


@app.post("/relationships/{account_id}/ask", response_model=RelationshipAnswer)
def ask_relationship(
    account_id: UUID,
    request: RelationshipQuestion,
    auth: AuthenticatedRequest = Depends(verify_supabase_token),
):
    user_id = auth.claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication subject",
        )
    enforce_rate_limit(user_id)

    try:
        context = retrieve_relationship_context(
            str(account_id),
            request.question,
            auth.bearer_token,
            match_count=5,
        )
    except Exception as error:
        logger.warning(
            "Relationship Q&A retrieval failed account_id=%s error_category=%s",
            account_id,
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Relationship context is temporarily unavailable",
        )

    if not context:
        return RelationshipAnswer(
            answer="There is insufficient evidence in this relationship's recorded interactions to answer that question.",
            sources=[],
            model_used=get_configured_model_name(),
        )

    try:
        answer = answer_relationship_question(request.question, context)
    except Exception as error:
        logger.warning(
            "Relationship Q&A answer failed account_id=%s error_category=%s",
            account_id,
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Relationship answer is temporarily unavailable",
        )

    sources = [
        RelationshipSource(
            interaction_id=chunk.interaction_id,
            created_at=chunk.created_at,
            similarity=chunk.similarity,
            excerpt=chunk.content[:240],
        )
        for chunk in context
    ]
    return RelationshipAnswer(
        answer=answer,
        sources=sources,
        model_used=get_configured_model_name(),
    )