"""
Server-side Gemini client. The API key lives only here (from env) — it is never
sent to the browser, which fixes the exposed-key hole in the old src/ai.js.

Exposes the four AI features the frontend needs. All calls run through the shared
TTL cache and degrade gracefully: on any error they raise, and the routers turn
that into a clean fallback so the UI never hard-fails.
"""
from __future__ import annotations

import json
import re

from google import genai
from google.genai import types

from .. import config
from . import cache

_client: genai.Client | None = None

# RIASEC dimension labels, matching the old client-side prompt.
_DIM_LABELS = {
    "R": "Realistic (hands-on)",
    "I": "Investigative (analytical)",
    "A": "Artistic (creative)",
    "S": "Social (people-focused)",
    "E": "Enterprising (leadership)",
    "C": "Conventional (structured)",
}
_STREAM_LABELS = {
    "pcm": "Science PCM",
    "pcb": "Science PCB",
    "commerce": "Commerce",
    "arts": "Arts/Humanities",
    "any": "Not decided",
}
_INTENSITY = ["", "Low", "Moderate", "High"]


def _lang_instruction(lang: str) -> str:
    """Extra prompt line telling Gemini to answer in Hindi when requested."""
    if (lang or "en").lower().startswith("hi"):
        return (
            "Write your entire response in simple, natural Hindi (Devanagari script) "
            "that a 14-16 year old Indian student easily understands. Keep well-known "
            "exam names, abbreviations and proper nouns in Latin script (NEET, JEE, "
            "MBBS, IIT, NIT, AIIMS, UPSC, CLAT, CAT, GATE, CA, PCM, PCB, Class 10/11/12)."
        )
    return ""


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not config.GEMINI_KEY:
            raise RuntimeError("GEMINI_KEY is not set")
        _client = genai.Client(api_key=config.GEMINI_KEY)
    return _client


async def _generate(prompt: str, *, temperature: float, max_tokens: int) -> str:
    client = _get_client()
    resp = await client.aio.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    text = (resp.text or "").strip()
    if not text:
        raise RuntimeError("Empty response from Gemini")
    return text


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _top_dims(riasec: dict[str, float], n: int = 3) -> list[str]:
    ordered = sorted(riasec.items(), key=lambda kv: kv[1], reverse=True)[:n]
    return [_DIM_LABELS.get(code, code) for code, _ in ordered]


def _student_block(riasec: dict, constraints: dict) -> str:
    dims = _top_dims(riasec)
    stream = _STREAM_LABELS.get(
        constraints.get("stream_pref"), constraints.get("stream_pref") or "Not decided"
    )
    intensity_idx = constraints.get("exam_intensity")
    intensity = (
        _INTENSITY[intensity_idx]
        if isinstance(intensity_idx, int) and 0 <= intensity_idx < len(_INTENSITY)
        else "Not specified"
    )
    return "\n".join(
        [
            "Student profile:",
            "- Top personality traits: " + ", ".join(dims),
            "- Preferred stream: " + str(stream),
            "- Years available for study: "
            + str(constraints.get("years_available", "Not specified")),
            "- Exam intensity preference: " + str(intensity),
        ]
    )


# ── Feature 1: rank domains (ported + improved from src/ai.js) ────────────────
async def rank_domains(
    riasec: dict, constraints: dict, domains: list[dict], lang: str = "en"
) -> list[dict]:
    domain_summaries = "\n".join(
        f"{d['category']}: {d['careers']}" for d in domains[:10]
    )
    # The frontend matches results back to domain headers by the English category
    # name, so the "category" value MUST stay English even in Hindi mode.
    hi = (lang or "en").lower().startswith("hi")
    lang_rule = (
        'Keep each "category" value EXACTLY as the English domain name given above. '
        'Write each "reason" in simple, natural Hindi (Devanagari) for a 14-16 year old; '
        "keep exam names and abbreviations (NEET, JEE, UPSC, PCM, etc.) in Latin script."
        if hi
        else ""
    )
    prompt = "\n".join(
        [
            "You are a warm, practical career counsellor helping an Indian Class 10 "
            "student (age 14-16) understand their career options.",
            "",
            _student_block(riasec, constraints),
            "",
            "Their top matching career domains (from a RIASEC assessment):",
            domain_summaries,
            "",
            "Task: Pick the TOP 4 domains that best fit this student. For each, write "
            "ONE short sentence (max 15 words) explaining WHY it fits — be specific to "
            "their traits and constraints, not generic.",
            "",
            "Respond in this exact JSON format (no markdown, no extra text):",
            '[{"category": "Domain Name", "reason": "One sentence why it fits."}]',
        ]
        + ([lang_rule] if lang_rule else [])
    )
    ck = cache.key_for("rank", lang, prompt)
    cached = cache.get(ck)
    if cached is not None:
        return json.loads(cached)

    raw = await _generate(prompt, temperature=0.4, max_tokens=400)
    parsed = json.loads(_strip_fences(raw))
    if not isinstance(parsed, list):
        raise ValueError("rank_domains: expected a JSON array")
    cache.set(ck, json.dumps(parsed))
    return parsed


# ── Feature 2: personalized summary ───────────────────────────────────────────
async def summary(
    riasec: dict, constraints: dict, top_matches: list[dict], lang: str = "en"
) -> str:
    matches = ", ".join(
        f"{m.get('name')} ({round((m.get('score') or 0) * 100)}% match)"
        for m in top_matches[:6]
        if m.get("name")
    )
    prompt = "\n".join(
        [
            "You are a career counsellor writing directly to an Indian Class 10 student.",
            "",
            _student_block(riasec, constraints),
            "",
            "Their strongest career matches: " + (matches or "n/a"),
            "",
            "Write a warm, encouraging 3-4 sentence summary (max 80 words) that: (1) names "
            "the 1-2 traits driving these matches, (2) explains what kind of work suits them, "
            "and (3) gives one concrete next step for Class 11. Speak to 'you'. Plain text, "
            "no markdown, no lists.",
        ]
        + ([_lang_instruction(lang)] if _lang_instruction(lang) else [])
    )
    ck = cache.key_for("summary", lang, prompt)
    cached = cache.get(ck)
    if cached is not None:
        return cached
    text = await _generate(prompt, temperature=0.6, max_tokens=250)
    cache.set(ck, text)
    return text


# ── Feature 3: "ask about this career" Q&A ────────────────────────────────────
async def chat(
    profession_name: str, context: str | None, question: str, lang: str = "en"
) -> str:
    prompt = "\n".join(
        [
            "You are a career counsellor answering an Indian Class 10 student's question "
            f"about becoming a {profession_name}.",
            "",
            ("Reference facts about this career:\n" + context) if context else "",
            "",
            "Student's question: " + question,
            "",
            "Answer in 2-4 short sentences (max 90 words), specific to India (exams, "
            "streams, typical path, realistic salary if asked). Be honest and encouraging. "
            "If the question is unrelated to careers/education, gently redirect. Plain text.",
        ]
        + ([_lang_instruction(lang)] if _lang_instruction(lang) else [])
    )
    # Questions are free-form; cache exact repeats only.
    ck = cache.key_for("chat", lang, profession_name, context or "", question.strip().lower())
    cached = cache.get(ck)
    if cached is not None:
        return cached
    text = await _generate(prompt, temperature=0.5, max_tokens=300)
    cache.set(ck, text, ttl=60 * 60 * 6)
    return text


# ── Feature 4: on-demand roadmap ──────────────────────────────────────────────
async def roadmap(
    profession_name: str, context: str | None, constraints: dict, lang: str = "en"
) -> str:
    stream = _STREAM_LABELS.get(
        constraints.get("stream_pref"), constraints.get("stream_pref") or "Not decided"
    )
    prompt = "\n".join(
        [
            f"Create a step-by-step roadmap for an Indian Class 10 student to become a "
            f"{profession_name}.",
            ("Reference facts:\n" + context) if context else "",
            f"Student's preferred stream: {stream}.",
            "",
            "Give 4-6 concise stages from Class 11 to first job. For each stage give a short "
            "label and one line of detail (stream choice, key entrance exams, degree, "
            "internships/skills). Be India-specific and realistic. Format as a numbered list, "
            "plain text, no markdown headers.",
        ]
        + ([_lang_instruction(lang)] if _lang_instruction(lang) else [])
    )
    ck = cache.key_for("roadmap", lang, profession_name, context or "", stream)
    cached = cache.get(ck)
    if cached is not None:
        return cached
    text = await _generate(prompt, temperature=0.5, max_tokens=500)
    cache.set(ck, text)
    return text
