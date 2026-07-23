"""Pydantic request/response models."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Results ──────────────────────────────────────────────────────────────────
class TopMatch(BaseModel):
    id: str | int | None = None
    name: str | None = None
    score: float | None = None


class ResultIn(BaseModel):
    """Mirrors the payload store.js builds today."""
    student_name: str | None = None
    student_email: str | None = None
    student_phone: str | None = None
    riasec_vector: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    top_matches: list[TopMatch] = Field(default_factory=list)
    user_agent: str | None = None


class ResultRow(BaseModel):
    id: str
    created_at: str
    student_name: str | None = None
    student_email: str | None = None
    student_phone: str | None = None
    riasec_vector: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    top_matches: list[dict[str, Any]] = Field(default_factory=list)
    user_agent: str | None = None


# ── AI ───────────────────────────────────────────────────────────────────────
class DomainMatch(BaseModel):
    category: str
    careers: str  # "Career A (72% match), Career B (65% match)"


class RankDomainsIn(BaseModel):
    riasec: dict[str, float] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    domains: list[DomainMatch] = Field(default_factory=list)


class RankedDomain(BaseModel):
    category: str
    reason: str


class SummaryIn(BaseModel):
    riasec: dict[str, float] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    top_matches: list[TopMatch] = Field(default_factory=list)


class ChatIn(BaseModel):
    profession_id: str | int | None = None
    profession_name: str | None = None
    profession_context: str | None = None  # optional grounding text from professions.json
    question: str


class RoadmapIn(BaseModel):
    profession_id: str | int | None = None
    profession_name: str
    profession_context: str | None = None
    constraints: dict[str, Any] = Field(default_factory=dict)


class TextOut(BaseModel):
    text: str
