"""
AI endpoints — all proxy Google Gemini server-side so the API key stays secret.

  POST /api/ai/rank-domains   ranked top-4 domains + reasons (drop-in for old ai.js)
  POST /api/ai/summary        personalized "why these fit you" paragraph
  POST /api/ai/chat           "ask about this career" Q&A
  POST /api/ai/roadmap        on-demand step-by-step roadmap

Each route is rate-limited per IP and degrades gracefully: on any failure it
returns a null/empty result (HTTP 200) so the frontend can silently fall back,
exactly as the old client-side code did (return null on error).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..deps import require_site_key
from ..models import (
    ChatIn,
    RankDomainsIn,
    RankedDomain,
    RoadmapIn,
    SummaryIn,
    TextOut,
)
from ..ratelimit import AI_LIMIT, limiter
from ..services import gemini

router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_site_key)])


@router.post("/rank-domains")
@limiter.limit(AI_LIMIT)
async def rank_domains(request: Request, payload: RankDomainsIn) -> list[RankedDomain] | None:
    try:
        result = await gemini.rank_domains(
            payload.riasec,
            payload.constraints,
            [d.model_dump() for d in payload.domains],
            payload.lang,
        )
        return [RankedDomain(**item) for item in result]
    except Exception:  # noqa: BLE001 — graceful degradation, same as old ai.js
        return None


@router.post("/summary", response_model=TextOut)
@limiter.limit(AI_LIMIT)
async def summary(request: Request, payload: SummaryIn) -> TextOut:
    try:
        text = await gemini.summary(
            payload.riasec,
            payload.constraints,
            [m.model_dump() for m in payload.top_matches],
            payload.lang,
        )
        return TextOut(text=text)
    except Exception:  # noqa: BLE001
        return TextOut(text="")


@router.post("/chat", response_model=TextOut)
@limiter.limit(AI_LIMIT)
async def chat(request: Request, payload: ChatIn) -> TextOut:
    if not payload.question.strip():
        return TextOut(text="")
    try:
        text = await gemini.chat(
            payload.profession_name or "this career",
            payload.profession_context,
            payload.question,
            payload.lang,
        )
        return TextOut(text=text)
    except Exception:  # noqa: BLE001
        return TextOut(text="")


@router.post("/roadmap", response_model=TextOut)
@limiter.limit(AI_LIMIT)
async def roadmap(request: Request, payload: RoadmapIn) -> TextOut:
    try:
        text = await gemini.roadmap(
            payload.profession_name,
            payload.profession_context,
            payload.constraints,
            payload.lang,
        )
        return TextOut(text=text)
    except Exception:  # noqa: BLE001
        return TextOut(text="")
