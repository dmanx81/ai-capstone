from collections import defaultdict
from contextlib import asynccontextmanager
from time import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.routers import accounts, ai, auth, billing, dashboard, intelligence, invites, timeline
from app.seed import seed_demo

settings = get_settings()
_hits: dict[str, list[float]] = defaultdict(list)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if settings.should_seed:
        db = SessionLocal()
        try:
            seed_demo(db)
        finally:
            db.close()
    yield


app = FastAPI(title="Relia API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_ai(request: Request, call_next):
    path = request.url.path
    if "/ask" in path or "/brief" in path or "/agents" in path:
        ip = request.client.host if request.client else "unknown"
        now = time()
        window = [t for t in _hits[ip] if now - t < 60]
        if len(window) >= 40:
            return JSONResponse({"detail": "Too many AI requests. Try again in a minute."}, status_code=429)
        window.append(now)
        _hits[ip] = window
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled(_request: Request, exc: Exception):
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        raise exc
    if settings.app_env == "development":
        return JSONResponse({"detail": str(exc), "type": type(exc).__name__}, status_code=500)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(invites.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(timeline.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "relia-api", "llm": settings.llm_provider, "embeddings": settings.embedding_provider}


@app.get("/api/v1/health")
def api_health() -> dict:
    return health()
