"""
Runtime configuration, read from environment variables.

Set these in the FastAPI Cloud dashboard (or a local .env for development):
  DATABASE_URL     Neon pooled Postgres connection string (postgresql://...)
  GEMINI_KEY       Google Gemini API key (server-side only, never shipped to browser)
  ADMIN_TOKEN      Bearer token that guards GET /api/results
  SITE_KEY         Shared X-Api-Key the frontend must send on write/AI routes
  ALLOWED_ORIGINS  Comma-separated CORS origins (default: the GitHub Pages site)
  GEMINI_MODEL     Optional model override (default: gemini-2.0-flash)
  AI_RATE_LIMIT    Optional per-IP limit for AI routes (default: 20/minute)
  RESULTS_RATE_LIMIT  Optional per-IP limit for POST /api/results (default: 10/minute)
  ENABLE_DOCS      Set to "1"/"true" to expose /docs, /redoc, /openapi.json (default: off)
  ENFORCE_ORIGIN   Set to "0"/"false" to disable the Origin allowlist on writes (default: on)
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _origins() -> list[str]:
    raw = os.getenv(
        "ALLOWED_ORIGINS",
        "https://akshaynikhare.github.io",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


def _bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


DATABASE_URL: str = os.getenv("DATABASE_URL", "")
GEMINI_KEY: str = os.getenv("GEMINI_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")
SITE_KEY: str = os.getenv("SITE_KEY", "")
ALLOWED_ORIGINS: list[str] = _origins()
AI_RATE_LIMIT: str = os.getenv("AI_RATE_LIMIT", "20/minute")
RESULTS_RATE_LIMIT: str = os.getenv("RESULTS_RATE_LIMIT", "10/minute")
ENABLE_DOCS: bool = _bool("ENABLE_DOCS", False)
ENFORCE_ORIGIN: bool = _bool("ENFORCE_ORIGIN", True)
