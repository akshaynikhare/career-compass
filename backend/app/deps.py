"""Shared request dependencies (auth guards)."""
from fastapi import Header, HTTPException

from . import config


async def require_site_key(x_api_key: str | None = Header(default=None)) -> None:
    """Gate the public frontend endpoints behind a shared site key.

    The frontend sends `X-Api-Key: <SITE_KEY>` (injected at deploy time). This
    blocks bots/scripts and other sites that don't send it. Because the key ships
    in a public static site it is a strong deterrent, not a true secret — pair it
    with the Origin allowlist and rate limiting.

    No-op until SITE_KEY is configured, so it can be rolled out safely.
    """
    if not config.SITE_KEY:
        return
    if x_api_key != config.SITE_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
