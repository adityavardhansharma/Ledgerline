"""Board-pack commentary that explains computed figures and never invents one.

The model receives a facts pack (id, formatted value, source) and answers with paragraphs made of segments.
Each segment is some words followed by an optional fact citation; the engine puts the fact's value after the
words, so the model never writes a number itself. Models label segments inconsistently (a "text" segment that
also cites a fact), so the label is ignored: words are always kept, and a cited fact is always inserted.
A validator rejects any words containing a digit, a currency sign or a percentage, and any citation of an
unknown fact; one retry is allowed with the error fed back.
"""

from __future__ import annotations

import json
import re

import httpx
from pydantic import BaseModel

from ..settings import Settings

DIGIT = re.compile(r"\d")


class Fact(BaseModel):
    id: str
    label: str
    value: str
    source: str


class CommentaryInvalid(ValueError):
    pass


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["paragraphs"],
    "properties": {
        "paragraphs": {
            "type": "array",
            "maxItems": 4,
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["text", "fact"],
                    "properties": {
                        "text": {"type": "string", "description": "Words, never a number"},
                        "fact": {"type": "string", "description": "A fact id whose value follows the words, or empty"},
                    },
                },
            },
        }
    },
}

SYSTEM = (
    "You write the commentary section of a small company's monthly management accounts. Write in plain "
    "British English for a business owner: what changed, why, and what deserves attention. Two or three short "
    "paragraphs. Each paragraph is a list of segments {text, fact}: the words of the segment, then the id of the "
    "fact whose value comes straight after those words (or an empty fact). For example "
    '[{"text": "Revenue was ", "fact": "revenue"}, {"text": " in the month.", "fact": ""}]. '
    "Never write a number, a currency sign or a percentage in text: every figure must come from a fact. "
    "Do not speculate beyond the facts."
)


def validate(payload: dict, facts: list[Fact]) -> list[list[str | dict]]:
    known = {f.id: f for f in facts}
    paragraphs = payload.get("paragraphs")
    if not isinstance(paragraphs, list) or not paragraphs:
        raise CommentaryInvalid("no paragraphs")
    rendered: list[list[str | dict]] = []
    cited = 0
    for paragraph in paragraphs:
        parts: list[str | dict] = []
        for segment in paragraph:
            text = segment.get("text") or ""
            fact_id = (segment.get("fact") or "").strip()
            if text:
                if DIGIT.search(text) or "€" in text or "%" in text:
                    raise CommentaryInvalid(f"number outside a citation: {text!r}")
                parts.append(text)
            if fact_id:
                fact = known.get(fact_id)
                if fact is None:
                    raise CommentaryInvalid(f"unknown fact {fact_id!r}")
                parts.append({"text": fact.value, "source": f"{fact.label} · {fact.source}"})
                cited += 1
        if parts:
            rendered.append(parts)
    if not rendered:
        raise CommentaryInvalid("no paragraphs")
    if not cited:
        raise CommentaryInvalid("no figures cited: state each figure by citing its fact")
    return rendered


def draft(facts: list[Fact], settings: Settings, http: httpx.Client | None = None) -> list[list[dict]]:
    if not settings.openrouter_api_key:
        raise CommentaryInvalid("commentary is not configured")
    client = http or httpx.Client(timeout=60)
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": "Facts:\n" + json.dumps([f.model_dump() for f in facts], ensure_ascii=False)},
    ]
    last_error = ""
    for _ in range(2):
        if last_error:
            messages.append({"role": "user", "content": f"Your previous answer was rejected: {last_error}. Try again."})
        response = client.post(
            f"{settings.openrouter_base}/chat/completions",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "X-Title": "Ledgerline"},
            json={
                "model": settings.openrouter_model,
                "messages": messages,
                "temperature": 0.3,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "commentary", "strict": True, "schema": SCHEMA},
                },
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        try:
            return validate(json.loads(content), facts)
        except (CommentaryInvalid, json.JSONDecodeError) as exc:
            last_error = str(exc)
    raise CommentaryInvalid(last_error)
