"""
Runtime configuration, read from environment variables.

Set these in the FastAPI Cloud dashboard (or a local .env for development):
  DATABASE_URL     Neon pooled Postgres connection string (postgresql://...)
  GEMINI_KEY       Google Gemini API key (server-side only, never shipped to browser)
  ADMIN_TOKEN      Bearer token that guards GET /api/results
  ALLOWED_ORIGINS  Comma-separated CORS origins (default: the GitHub Pages site)
  GEMINI_MODEL     Optional model override (default: gemini-2.0-flash)
  AI_RATE_LIMIT    Optional per-IP limit for AI routes (default: 20/minute)
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


DATABASE_URL: str = os.getenv("DATABASE_URL", "")
GEMINI_KEY: str = os.getenv("GEMINI_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")
ALLOWED_ORIGINS: list[str] = _origins()
AI_RATE_LIMIT: str = os.getenv("AI_RATE_LIMIT", "20/minute")
