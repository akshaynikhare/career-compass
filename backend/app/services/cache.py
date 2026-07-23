"""
Tiny in-process TTL cache, keyed by a hash of the prompt.

AI outputs for rank/summary/roadmap are stable enough to cache, which cuts Gemini
calls (and cost) sharply when many students share similar profiles. Because
FastAPI Cloud Hobby scales to zero and may run up to 2 replicas, this cache is
best-effort per-process — a persistent cache table can be added later if needed.
"""
from __future__ import annotations

import hashlib
import time

_store: dict[str, tuple[float, str]] = {}
_DEFAULT_TTL = 60 * 60 * 24  # 24h
_MAX_ENTRIES = 2000


def key_for(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def get(key: str) -> str | None:
    entry = _store.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if expires_at < time.monotonic():
        _store.pop(key, None)
        return None
    return value


def set(key: str, value: str, ttl: int = _DEFAULT_TTL) -> None:
    if len(_store) >= _MAX_ENTRIES:
        # Evict the soonest-to-expire entry (cheap approximation of LRU).
        oldest = min(_store.items(), key=lambda kv: kv[1][0], default=None)
        if oldest:
            _store.pop(oldest[0], None)
    _store[key] = (time.monotonic() + ttl, value)
