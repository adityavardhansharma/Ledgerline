"""Board-pack commentary that explains computed figures and never invents one.

The model receives a facts pack (id, label, formatted value, source, group) and writes a structured board pack:
a headline, performance, cash and working capital, outlook, risks, decisions and the questions a board may ask.
All prose is made of segments: some words followed by an optional fact citation; the engine puts the fact's
value after the words, so the model never writes a number itself. A validator rejects any words containing a
digit, a currency sign or a percentage, and any citation of an unknown fact; one retry is allowed with the error
fed back. One section can be redrafted on its own, with the rest of the pack as context.

Management notes give context only the team knows ("lost the Murphy contract"). They shape the explanation but
are never a source of figures.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from ..settings import Settings
from .facts import Fact

DIGIT = re.compile(r"\d")

SEGMENT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["text", "fact"],
    "properties": {
        "text": {"type": "string", "description": "Words, never a number"},
        "fact": {"type": "string", "description": "A fact id whose value follows the words, or empty"},
    },
}
SEGMENTS = {"type": "array", "items": SEGMENT}
PARAGRAPHS = {"type": "array", "items": SEGMENTS}

SECTIONS: dict[str, dict[str, Any]] = {
    "headline": {
        "title": "Headline",
        "schema": {"type": "array", "maxItems": 4, "items": SEGMENTS},
        "brief": "Three short bullets a director reads in ten seconds: the month's result, the cash position and the single thing that matters most next.",
    },
    "performance": {
        "title": "Performance",
        "schema": PARAGRAPHS,
        "brief": "Revenue, margin, overheads and profit. Compare with the previous month, the same month last year, the year to date and the plan where facts exist, and explain the change using the accounts that moved most and the customers.",
    },
    "cash": {
        "title": "Cash and working capital",
        "schema": PARAGRAPHS,
        "brief": "How cash moved and why: trading, debtors, equipment, loans and dividends. Then what customers owe, overdue invoices, and how fast customers pay and suppliers are paid.",
    },
    "outlook": {
        "title": "Outlook",
        "schema": PARAGRAPHS,
        "brief": "What the base-case forecast says about runway, the lowest cash point and the next twelve months, the assumption that matters most, and what each scenario changes.",
    },
    "risks": {
        "title": "Risks and watch list",
        "schema": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["level", "title", "detail"],
                "properties": {
                    "level": {"type": "string", "enum": ["red", "amber", "green"]},
                    "title": {"type": "string", "description": "A few words naming the risk, never a number"},
                    "detail": SEGMENTS,
                },
            },
        },
        "brief": "Two to five items rated red (act now), amber (watch) or green (healthy), led by the signals given. Each has a short title and one sentence citing the figure behind it.",
    },
    "decisions": {
        "title": "Decisions for the board",
        "schema": {"type": "array", "maxItems": 3, "items": SEGMENTS},
        "brief": "Up to three concrete decisions or approvals the board could take, each grounded in a fact (for example funding before the lowest cash point, chasing overdue debtors, or approving a hire). Empty if nothing needs deciding.",
    },
    "questions": {
        "title": "Questions the board may ask",
        "schema": {
            "type": "array",
            "maxItems": 4,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question", "answer"],
                "properties": {"question": SEGMENTS, "answer": SEGMENTS},
            },
        },
        "brief": "Two to four questions a sharp director would ask about these figures, each with a short answer from the facts and notes.",
    },
}
ORDER = list(SECTIONS)
PROSE = ("headline", "performance", "cash", "outlook", "decisions")

TONES = {
    "board": "Write for a board of directors: measured, precise, and plain British English.",
    "investor": "Write as an update for investors: confident and forward-looking, but never beyond the facts.",
    "brief": "Write as tersely as possible for a busy owner: short sentences, no preamble.",
}
LENGTHS = {
    "short": "Keep each prose section to one short paragraph.",
    "standard": "Keep each prose section to one or two paragraphs.",
    "detailed": "Each prose section may have up to three paragraphs; use more of the comparisons.",
}

SYSTEM = (
    "You write the commentary for a small company's monthly management accounts. Explain what changed, why, and "
    "what deserves attention, using the facts given. Every piece of prose is a list of segments {text, fact}: the "
    "words of the segment, then the id of the fact whose value comes straight after those words (or an empty "
    'fact). For example [{"text": "Revenue was ", "fact": "revenue"}, {"text": ", ", "fact": "revenueVsPrev"}, '
    '{"text": " on the previous month.", "fact": ""}]. Never write a number, a year, a currency sign or a '
    "percentage in text: every figure, date with a year, and amount must come from a fact (the month itself is the "
    "fact 'month'). Read each fact's label so the words around it make sense: a label saying 'down' means a fall, and a change is a difference, never a starting or ending level. "
    "Cite each figure at most once per section and do not repeat a figure the headline already gave unless it adds "
    "a comparison. Management notes are context from the team: use them to explain causes, never quote figures "
    "from them, and never contradict the facts. Do not speculate beyond the facts and notes."
)


class CommentaryInvalid(ValueError):
    pass


def _schema(sections: list[str]) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": sections,
        "properties": {key: SECTIONS[key]["schema"] for key in sections},
    }


def _render(segments: list[dict], known: dict[str, Fact], where: str) -> tuple[list[str | dict], int]:
    parts: list[str | dict] = []
    cited = 0
    for segment in segments or []:
        text = segment.get("text") or ""
        fact_id = (segment.get("fact") or "").strip()
        if text:
            if DIGIT.search(text) or "€" in text or "%" in text:
                raise CommentaryInvalid(f"number outside a citation in {where}: {text!r}")
            parts.append(text)
        if fact_id:
            fact = known.get(fact_id)
            if fact is None:
                raise CommentaryInvalid(f"unknown fact {fact_id!r} in {where}")
            parts.append({"text": fact.value, "source": f"{fact.label} · {fact.source}", "fact": fact.id})
            cited += 1
    return parts, cited


def _plain(text: str, where: str) -> str:
    if DIGIT.search(text) or "€" in text or "%" in text:
        raise CommentaryInvalid(f"number in {where}: {text!r}")
    return text.strip()


def validate_sections(payload: dict, facts: list[Fact], sections: list[str]) -> dict:
    """Render each section's segments, inserting cited values. Raises CommentaryInvalid on any breach."""
    known = {f.id: f for f in facts}
    out: dict[str, Any] = {}
    cited = 0
    for key in sections:
        raw = payload.get(key)
        if not isinstance(raw, list):
            raise CommentaryInvalid(f"missing section {key}")
        if key in PROSE:
            rendered = []
            for item in raw:
                parts, n = _render(item, known, key)
                cited += n
                if parts:
                    rendered.append(parts)
            out[key] = rendered
        elif key == "risks":
            out[key] = []
            for item in raw:
                parts, n = _render(item.get("detail") or [], known, key)
                cited += n
                level = item.get("level") if item.get("level") in ("red", "amber", "green") else "amber"
                out[key].append({"level": level, "title": _plain(item.get("title") or "", "a risk title"), "detail": parts})
        elif key == "questions":
            out[key] = []
            for item in raw:
                q, _ = _render(item.get("question") or [], known, "a question")
                a, n = _render(item.get("answer") or [], known, "an answer")
                cited += n
                if q and a:
                    out[key].append({"question": q, "answer": a})
    if "headline" in sections and not out.get("headline"):
        raise CommentaryInvalid("the headline is empty")
    if not cited and any(k in sections for k in ("headline", "performance", "cash", "outlook")):
        raise CommentaryInvalid("no figures cited: state each figure by citing its fact")
    return out


def _as_text(parts: list) -> str:
    return "".join(p if isinstance(p, str) else p.get("text", "") for p in parts)


def _section_text(key: str, value: Any) -> str:
    if key == "risks":
        return "\n".join(f"- [{r['level']}] {r['title']}: {_as_text(r['detail'])}" for r in value)
    if key == "questions":
        return "\n".join(f"- Q: {_as_text(x['question'])} A: {_as_text(x['answer'])}" for x in value)
    return "\n".join(f"- {_as_text(p)}" for p in value)


def _complete(settings: Settings, messages: list[dict], schema: dict, name: str, http: httpx.Client | None) -> dict:
    if not settings.openrouter_api_key:
        raise CommentaryInvalid("commentary is not configured")
    client = http or httpx.Client(timeout=120)
    response = client.post(
        f"{settings.openrouter_base}/chat/completions",
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "X-Title": "Ledgerline"},
        json={
            "model": settings.openrouter_model,
            "messages": messages,
            "temperature": 0.3,
            "response_format": {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}},
        },
    )
    response.raise_for_status()
    return json.loads(response.json()["choices"][0]["message"]["content"])


def _facts_message(facts: list[Fact], signals: list[dict], notes: str) -> str:
    groups: dict[str, list[dict]] = {}
    for f in facts:
        groups.setdefault(f.group or "other", []).append({"id": f.id, "label": f.label, "value": f.value})
    body = "Facts, by topic:\n" + json.dumps(groups, ensure_ascii=False, indent=1)
    body += "\n\nSignals worth the board's attention (plain words, for the risks section):\n" + json.dumps(
        signals, ensure_ascii=False
    )
    body += "\n\nManagement notes for this month:\n" + (notes.strip() or "(none)")
    return body


def draft(
    facts: list[Fact],
    settings: Settings,
    *,
    signals: list[dict] | None = None,
    notes: str = "",
    tone: str = "board",
    length: str = "standard",
    section: str | None = None,
    current: dict | None = None,
    http: httpx.Client | None = None,
) -> dict:
    """The whole board pack, or one section of it when ``section`` is given (with ``current`` as context)."""
    if section and section not in SECTIONS:
        raise CommentaryInvalid(f"unknown section {section!r}")
    sections = [section] if section else ORDER
    guide = "\n".join(f"- {key} ({SECTIONS[key]['title']}): {SECTIONS[key]['brief']}" for key in sections)
    ask = f"Write these sections:\n{guide}\n\n{TONES.get(tone, TONES['board'])} {LENGTHS.get(length, LENGTHS['standard'])}"
    if section and current:
        others = "\n\n".join(
            f"{SECTIONS[k]['title']}:\n{_section_text(k, v)}" for k, v in current.items() if k != section and k in SECTIONS
        )
        ask += f"\n\nThe rest of the pack, for context (do not repeat it):\n{others}\n\nWrite a fresh version of the {SECTIONS[section]['title']} section."
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": _facts_message(facts, signals or [], notes) + "\n\n" + ask},
    ]
    last_error = ""
    for _ in range(2):
        if last_error:
            messages.append({"role": "user", "content": f"Your previous answer was rejected: {last_error}. Try again."})
        try:
            return validate_sections(_complete(settings, messages, _schema(sections), "board_pack", http), facts, sections)
        except (CommentaryInvalid, json.JSONDecodeError) as exc:
            last_error = str(exc)
    raise CommentaryInvalid(last_error)


ASK_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["answer"],
    "properties": {"answer": {"type": "array", "maxItems": 3, "items": SEGMENTS}},
}


def answer(
    facts: list[Fact],
    question: str,
    settings: Settings,
    *,
    notes: str = "",
    history: list[dict] | None = None,
    http: httpx.Client | None = None,
) -> list[list[str | dict]]:
    """Answer a question about the figures, citing facts. Says so plainly when the facts can't answer it."""
    messages = [
        {
            "role": "system",
            "content": SYSTEM
            + " Now answer the owner's question in one to three short paragraphs. If the facts cannot answer it, say "
            "so and say what information would.",
        },
        {"role": "user", "content": _facts_message(facts, [], notes)},
    ]
    for turn in (history or [])[-4:]:
        messages.append({"role": "user", "content": str(turn.get("question", ""))[:500]})
        messages.append({"role": "assistant", "content": str(turn.get("answer", ""))[:1500]})
    messages.append({"role": "user", "content": question[:500]})
    known = {f.id: f for f in facts}
    last_error = ""
    for _ in range(2):
        if last_error:
            messages.append({"role": "user", "content": f"Your previous answer was rejected: {last_error}. Try again."})
        try:
            payload = _complete(settings, messages, ASK_SCHEMA, "answer", http)
            out = []
            for paragraph in payload.get("answer") or []:
                parts, _ = _render(paragraph, known, "the answer")
                if parts:
                    out.append(parts)
            if not out:
                raise CommentaryInvalid("empty answer")
            return out
        except (CommentaryInvalid, json.JSONDecodeError) as exc:
            last_error = str(exc)
    raise CommentaryInvalid(last_error)
