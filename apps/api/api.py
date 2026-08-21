import json
import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
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
logger = logging.getLogger("apps.api")


def configure_sentry():
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return None
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("APP_ENV", "development"),
            send_default_pii=False,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
            attach_stacktrace=False,
        )
        return sentry_sdk
    except Exception:  # pragma: no cover
        logger.warning("Sentry configuration is unavailable; continuing without it")
        return None


configure_sentry()


def _safe_log_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _safe_log_value(v) for k, v in value.items() if k not in {"customer_text", "raw_text", "prompt", "jwt", "token", "authorization"}}
    if isinstance(value, (list, tuple)):
        return [_safe_log_value(v) for v in value]
    return str(value)


def build_request_log_fields(
    *,
    request_id: str,
    path: str,
    method: str,
    account_id: Optional[str] = None,
    interaction_id: Optional[str] = None,
    user_id: Optional[str] = None,
    duration_ms: int,
    status_code: int,
    request_meta: Optional[dict[str, Any]] = None,
    request_body: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    fields = {
        "request_id": request_id,
        "path": path,
        "method": method,
        "duration_ms": duration_ms,
        "status_code": status_code,
        "account_id": account_id,
        "interaction_id": interaction_id,
        "user_id": user_id,
        "meta": _safe_log_value(request_meta or {}),
    }
    if request_body:
        fields["body"] = {
            key: _safe_log_value(value)
            for key, value in request_body.items()
            if key not in {"customer_text", "raw_text", "prompt", "jwt", "token", "authorization"}
        }
    return fields


def cors_allows_credentials_with_wildcard() -> bool:
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    return any(origin.strip() == "*" for origin in allowed_origins) and os.getenv("ALLOW_CREDENTIALS", "false").lower() == "true"


app = FastAPI(
    title="AI Capstone API",
    version="1.0.0",
)

allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    logger.info(
        "http_request",
        extra={
            **build_request_log_fields(
                request_id=request_id,
                path=request.url.path,
                method=request.method,
                duration_ms=elapsed_ms,
                status_code=response.status_code,
                request_meta={"endpoint": request.url.path},
            )
        },
    )
    response.headers["x-request-id"] = request_id
    return response


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
    return {"status": "ok"}


@app.get("/ready")
def ready():
    missing = []
    for env_name in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
        if not os.getenv(env_name):
            missing.append(env_name)
    if missing:
        return {"status": "not_ready", "missing": missing}
    return {"status": "ready"}


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
    request_id = str(uuid.uuid4())
    started = time.perf_counter()

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
            "historical_context_retrieval_failed",
            extra={**build_request_log_fields(
                request_id=request_id,
                path="/analyze",
                method="POST",
                account_id=str(request.account_id),
                interaction_id=str(request.interaction_id),
                user_id=user_id,
                duration_ms=round((time.perf_counter() - started) * 1000),
                status_code=200,
                request_meta={"error_category": type(error).__name__},
            )},
        )

    analyze_result = analyze_account(
        request.customer_text,
        historical_context,
        return_model_used=True,
    )
    if isinstance(analyze_result, tuple):
        brief, model_used = analyze_result
    else:
        brief = analyze_result
        model_used = get_configured_model_name()

    try:
        ingestion = ingest_interaction_memory(
            str(request.account_id),
            str(request.interaction_id),
            request.customer_text,
            auth.bearer_token,
        )
        logger.info(
            "interaction_memory_ingestion_completed",
            extra={**build_request_log_fields(
                request_id=request_id,
                path="/analyze",
                method="POST",
                account_id=str(request.account_id),
                interaction_id=str(request.interaction_id),
                user_id=user_id,
                duration_ms=round((time.perf_counter() - started) * 1000),
                status_code=200,
                request_meta={"chunks_created": ingestion.chunks_created, "model_used": model_used},
            )},
        )
    except Exception as error:
        logger.warning(
            "interaction_memory_ingestion_failed",
            extra={**build_request_log_fields(
                request_id=request_id,
                path="/analyze",
                method="POST",
                account_id=str(request.account_id),
                interaction_id=str(request.interaction_id),
                user_id=user_id,
                duration_ms=round((time.perf_counter() - started) * 1000),
                status_code=200,
                request_meta={"error_category": type(error).__name__, "model_used": model_used},
            )},
        )

    payload = {**brief.model_dump(), "model_used": model_used}
    logger.info(
        "analysis_completed",
        extra={**build_request_log_fields(
            request_id=request_id,
            path="/analyze",
            method="POST",
            account_id=str(request.account_id),
            interaction_id=str(request.interaction_id),
            user_id=user_id,
            duration_ms=round((time.perf_counter() - started) * 1000),
            status_code=200,
            request_meta={"model_used": model_used},
        )},
    )
    return payload


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
            "relationship_qa_retrieval_failed",
            extra={**build_request_log_fields(
                request_id=str(uuid.uuid4()),
                path=f"/relationships/{account_id}/ask",
                method="POST",
                account_id=str(account_id),
                user_id=user_id,
                duration_ms=0,
                status_code=503,
                request_meta={"error_category": type(error).__name__},
            )},
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