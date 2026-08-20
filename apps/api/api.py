import os
import threading
import time
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from apps.api.analyzer import analyze_account, get_configured_model_name


SUPABASE_URL = os.environ["SUPABASE_URL"]

SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1"
SUPABASE_JWKS_URL = f"{SUPABASE_ISSUER}/.well-known/jwks.json"

security = HTTPBearer(auto_error=False)
jwks_client = PyJWKClient(SUPABASE_JWKS_URL, timeout=5)

RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60 * 60
request_timestamps: dict[str, list[float]] = {}
rate_limit_lock = threading.Lock()


app = FastAPI(
    title="AI Capstone API",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    customer_text: str = Field(min_length=40, max_length=50_000)


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

        return payload

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
    claims: dict = Depends(verify_supabase_token),
):
    user_id = claims.get("sub")

    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication subject",
        )

    enforce_rate_limit(user_id)

    brief = analyze_account(
        request.customer_text
    )

    return {
        **brief.model_dump(),
        "model_used": get_configured_model_name(),
    }