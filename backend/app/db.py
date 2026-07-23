"""
Neon Postgres connection pool (asyncpg).

The pool is opened on app startup and closed on shutdown (see main.py lifespan).
Neon's free tier autosuspends compute after ~5 min idle and wakes in ~500ms on the
next query, so the first request after a quiet period may be slightly slower — the
pool handles reconnection transparently.
"""
import asyncpg

from . import config

_pool: asyncpg.Pool | None = None


async def connect() -> None:
    global _pool
    if _pool is None:
        if not config.DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = await asyncpg.create_pool(
            dsn=config.DATABASE_URL,
            min_size=1,
            max_size=5,
            # Neon requires SSL; the connection string usually carries sslmode=require.
            command_timeout=30,
        )


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool
