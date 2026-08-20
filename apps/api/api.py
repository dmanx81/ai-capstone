import os
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel

from apps.api.analyzer import analyze_account


SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://gmyrbxeyzkeinvwrdjip.supabase.co",
)

SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1"
SUPABASE_JWKS_URL = f"{SUPABASE_ISSUER}/.well-known/jwks.json"

security = HTTPBearer(auto_error=False)
jwks_client = PyJWKClient(SUPABASE_JWKS_URL)


app = FastAPI(
    title="AI Capstone API",
    version="1.0.0",
)


class AnalyzeRequest(BaseModel):
    customer_text: str


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
        header = jwt.get_unverified_header(token)

        claims = jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )

        print(
            "JWT DEBUG:",
            {
                "alg": header.get("alg"),
                "kid": header.get("kid"),
                "iss": claims.get("iss"),
                "aud": claims.get("aud"),
                "role": claims.get("role"),
                "exp": claims.get("exp"),
            },
        )

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

    except jwt.ExpiredSignatureError as error:
        print("JWT ERROR: expired token:", repr(error))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        )

    except jwt.InvalidAudienceError as error:
        print("JWT ERROR: invalid audience:", repr(error))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )

    except jwt.InvalidIssuerError as error:
        print("JWT ERROR: invalid issuer:", repr(error))

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )

    except Exception as error:
        print("JWT ERROR:", type(error).__name__, repr(error))

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
    brief = analyze_account(
        request.customer_text
    )

    return brief.model_dump()
