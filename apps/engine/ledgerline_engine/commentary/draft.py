"""Board-pack commentary that explains computed figures and never invents one.

The model receives a facts pack (id, formatted value, source) and must answer with paragraphs made of
text segments and fact citations. A validator rejects any text segment containing a digit and any
citation of an unknown fact; one retry is allowed with the error fed back.
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
                    "required": ["type", "text", "fact"],
                    "properties": {
                        "type": {"type": "string", "enum": ["text", "fact"]},
                        "text": {"type": "string"},
                        "fact": {"type": "string"},
                    },
                },
            },
        }
    },
}

SYSTEM = (
    "You write the commentary section of a small company's monthly management accounts. Write in plain "
    "British English for a business owner: what changed, why, and what deserves attention. Two or three short "
    "paragraphs. You may only state numbers by citing a fact: a segment {type:'fact', fact:<id>, text:''}. "
    "Text segments must never contain a digit, a currency sign or a percentage. Do not speculate beyond the facts."
)


def validate(payload: dict, facts: list[Fact]) -> list[list[dict]]:
    known = {f.id: f for f in facts}
    paragraphs = payload.get("paragraphs")
    if not isinstance(paragraphs, list) or not paragraphs:
        raise CommentaryInvalid("no paragraphs")
    rendered: list[list[dict]] = []
    for paragraph in paragraphs:
        parts: list[dict] = []
        for segment in paragraph:
            if segment.get("type") == "fact":
                fact = known.get(segment.get("fact", ""))
                if fact is None:
                    raise CommentaryInvalid(f"unknown fact {segment.get('fact')!r}")
                parts.append({"text": fact.value, "source": f"{fact.label} · {fact.source}"})
            else:
                text = segment.get("text", "")
                if DIGIT.search(text) or "€" in text or "%" in text:
                    raise CommentaryInvalid(f"number outside a citation: {text!r}")
                parts.append(text)
        rendered.append(parts)
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
