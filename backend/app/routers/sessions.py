"""
In-flight test-session endpoints — power "resume your test on any device".

  POST /api/sessions          public  — create a session, returns its id (the resume link)
  POST /api/sessions/{id}     public  — checkpoint progress (answers / index / status)
  GET  /api/sessions/{id}     public  — fetch state to resume (no email/phone returned)
  GET  /api/sessions          admin   — list captured sessions (Bearer ADMIN_TOKEN)

The session id is a random uuid and is the resume link's only secret, so the public
GET route returns just enough to continue the test — never the email/phone.
POST is used for updates (not PATCH) because CORS only allows GET/POST/OPTIONS.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from .. import config, db
from ..deps import require_site_key
from ..models import SessionCreateIn, SessionOut, SessionRow, SessionUpdateIn
from ..ratelimit import limiter

router = APIRouter(prefix="/api", tags=["sessions"])


async def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not config.ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if authorization != f"Bearer {config.ADMIN_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _verify_origin(request: Request) -> None:
    """Reject cross-site / non-browser writes (CORS only guards reading the response)."""
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


def _jsonb(value):
    return json.loads(value) if isinstance(value, str) else value


@router.post("/sessions", dependencies=[Depends(require_site_key)])
@limiter.limit(config.SESSIONS_RATE_LIMIT)
async def create_session(request: Request, payload: SessionCreateIn) -> dict:
    _verify_origin(request)
    try:
        row = await db.pool().fetchrow(
            """
            insert into test_sessions
              (student_name, student_email, student_phone, question_ids, user_agent)
            values ($1, $2, $3, $4::jsonb, $5)
            returning id
            """,
            payload.student_name,
            payload.student_email,
            payload.student_phone,
            json.dumps(payload.question_ids),
            payload.user_agent,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not create session") from exc
    return {"id": str(row["id"])}


@router.post("/sessions/{session_id}", dependencies=[Depends(require_site_key)])
@limiter.limit(config.SESSIONS_RATE_LIMIT)
async def update_session(request: Request, session_id: str, payload: SessionUpdateIn) -> dict:
    _verify_origin(request)
    status = payload.status if payload.status in ("in_progress", "completed") else None
    try:
        row = await db.pool().fetchrow(
            """
            update test_sessions set
              answers       = $2::jsonb,
              constraints   = $3::jsonb,
              current_index = $4,
              status        = coalesce($5, status),
              student_name  = coalesce($6, student_name),
              student_email = coalesce($7, student_email),
              student_phone = coalesce($8, student_phone),
              updated_at    = now()
            where id = $1
            returning id
            """,
            session_id,
            json.dumps(payload.answers),
            json.dumps(payload.constraints),
            payload.current_index,
            status,
            payload.student_name,
            payload.student_email,
            payload.student_phone,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not save session") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@router.get("/sessions/{session_id}", response_model=SessionOut, dependencies=[Depends(require_site_key)])
@limiter.limit(config.SESSIONS_RATE_LIMIT)
async def get_session(request: Request, session_id: str) -> SessionOut:
    try:
        row = await db.pool().fetchrow(
            """
            select id, status, student_name, question_ids, answers, constraints, current_index
            from test_sessions
            where id = $1
            """,
            session_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Could not load session") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionOut(
        id=str(row["id"]),
        status=row["status"],
        student_name=row["student_name"],
        question_ids=_jsonb(row["question_ids"]),
        answers=_jsonb(row["answers"]),
        constraints=_jsonb(row["constraints"]),
        current_index=row["current_index"],
    )


@router.get("/sessions", response_model=list[SessionRow], dependencies=[Depends(require_admin)])
async def list_sessions(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[SessionRow]:
    rows = await db.pool().fetch(
        """
        select id, created_at, updated_at, status,
               student_name, student_email, student_phone, current_index
        from test_sessions
        order by updated_at desc
        limit $1 offset $2
        """,
        limit,
        offset,
    )
    return [
        SessionRow(
            id=str(r["id"]),
            created_at=r["created_at"].isoformat(),
            updated_at=r["updated_at"].isoformat(),
            status=r["status"],
            student_name=r["student_name"],
            student_email=r["student_email"],
            student_phone=r["student_phone"],
            current_index=r["current_index"],
        )
        for r in rows
    ]
