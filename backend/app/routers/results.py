"""
Result storage endpoints.

  POST /api/results   public   — replaces the old direct Supabase INSERT
  GET  /api/results   admin    — NEW: read collected results (Bearer ADMIN_TOKEN)

The GET route is new value: with Supabase's insert-only RLS the site owner could
never read their own captured leads. Now they can, for CSV export / a dashboard.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from .. import config, db
from ..deps import require_site_key
from ..models import ResultIn, ResultRow
from ..ratelimit import limiter

router = APIRouter(prefix="/api", tags=["results"])


async def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not config.ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    expected = f"Bearer {config.ADMIN_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _verify_origin(request: Request) -> None:
    """Reject cross-site / non-browser writes. CORS only blocks the *response* from
    being read — the request still reaches the DB — so we enforce the allowlist here."""
    if not config.ENFORCE_ORIGIN:
        return
    origin = request.headers.get("origin")
    if origin is not None:
        if origin in config.ALLOWED_ORIGINS:
            return
    else:
        referer = request.headers.get("referer", "")
        if any(referer.startswith(o) for o in config.ALLOWED_ORIGINS):
            return
    raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/results", dependencies=[Depends(require_site_key)])
@limiter.limit(config.RESULTS_RATE_LIMIT)
async def create_result(request: Request, payload: ResultIn) -> dict:
    _verify_origin(request)
    top_matches = [m.model_dump(exclude_none=True) for m in payload.top_matches]
    try:
        await db.pool().execute(
            """
            insert into career_test_results
              (student_name, student_email, student_phone,
               riasec_vector, constraints, top_matches, user_agent)
            values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
            """,
            payload.student_name,
            payload.student_email,
            payload.student_phone,
            json.dumps(payload.riasec_vector),
            json.dumps(payload.constraints),
            json.dumps(top_matches),
            payload.user_agent,
        )
    except Exception as exc:  # noqa: BLE001 — never leak DB internals to the client
        raise HTTPException(status_code=502, detail="Could not save result") from exc
    return {"ok": True}


@router.get("/results", response_model=list[ResultRow], dependencies=[Depends(require_admin)])
async def list_results(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[ResultRow]:
    rows = await db.pool().fetch(
        """
        select id, created_at, student_name, student_email, student_phone,
               riasec_vector, constraints, top_matches, user_agent
        from career_test_results
        order by created_at desc
        limit $1 offset $2
        """,
        limit,
        offset,
    )
    out: list[ResultRow] = []
    for r in rows:
        out.append(
            ResultRow(
                id=str(r["id"]),
                created_at=r["created_at"].isoformat(),
                student_name=r["student_name"],
                student_email=r["student_email"],
                student_phone=r["student_phone"],
                riasec_vector=json.loads(r["riasec_vector"]) if isinstance(r["riasec_vector"], str) else r["riasec_vector"],
                constraints=json.loads(r["constraints"]) if isinstance(r["constraints"], str) else r["constraints"],
                top_matches=json.loads(r["top_matches"]) if isinstance(r["top_matches"], str) else r["top_matches"],
                user_agent=r["user_agent"],
            )
        )
    return out
