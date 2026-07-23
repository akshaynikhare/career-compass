"""
Career Compass API — FastAPI backend.

Owns the Neon Postgres database (result capture) and proxies all Gemini AI calls
so no secret key is ever shipped to the browser. The static GitHub Pages frontend
calls this service instead of hitting Supabase/Gemini directly.

Run locally:   uvicorn app.main:app --reload
Deploy:        fastapi deploy   (see backend/README.md)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import config, db
from .ratelimit import limiter
from .routers import ai, results

logger = logging.getLogger("career-compass")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Don't let a DB hiccup crash startup — the app boots, /health responds, and
    # DB-backed routes surface a clean 502 until the pool is available.
    try:
        await db.connect()
    except Exception as exc:  # noqa: BLE001
        logger.error("Database pool init failed at startup: %s", exc)
    yield
    await db.disconnect()


app = FastAPI(title="Career Compass API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(results.router)
app.include_router(ai.router)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"ok": True, "service": "career-compass-api"}
