"""Per-IP rate limiting for the AI endpoints (slowapi)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from . import config

limiter = Limiter(key_func=get_remote_address, default_limits=[])

# Applied as a decorator on AI routes.
AI_LIMIT = config.AI_RATE_LIMIT
