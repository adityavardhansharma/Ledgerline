"""What every AI action shares: the model call with one retry, cited prose, and checks on stated numbers."""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any

import httpx

from ..commentary.draft import SEGMENTS, CommentaryInvalid, _complete, _render
from ..commentary.facts import Fact
from ..settings import Settings

__all__ = ["SEGMENTS", "ActionInvalid", "PROSE_RULES", "cited", "facts_message", "run", "stated_numbers"]

ActionInvalid = CommentaryInvalid

PROSE_RULES = (
    "You write a short explanation inside a finance app for a small business owner: plain British English, short "
    "sentences, only the figures that matter. Prose is a list of segments {text, fact}: some words, then the id of the "
    "fact whose value comes straight after them (or an empty fact). Never write a number, a year, a currency sign or "
    "a percentage in text: every figure comes from a fact. Read each fact's label so the words fit: 'up' and 'down' "
    "give the direction, a value reading 'X to Y' gives both levels (write 'from' just before it), and a fact marked "
    "(percentage) or (amount) is a change, not a level. Never speculate beyond the facts; if they can't explain "
    "something, say what information would."
)


def facts_message(facts: list[Fact]) -> str:
    return "Facts:\n" + json.dumps(
        [{"id": f.id, "label": f.label, "value": f.value} for f in facts], ensure_ascii=False, indent=1
    )


def cited(segments: list[dict], facts: list[Fact], where: str, limit: int) -> list[str | dict]:
    """Render segments, inserting each cited value, and refuse more figures than ``limit``."""
    parts, count = _render(segments, {f.id: f for f in facts}, where)
    if count > limit:
        raise ActionInvalid(f"too many figures in {where} ({count}); keep to the {limit} that matter most")
    return parts


def run(
    settings: Settings,
    system: str,
    user: str,
    schema: dict,
    validate: Callable[[dict], Any],
    *,
    name: str = "action",
    http: httpx.Client | None = None,
) -> Any:
    """Ask the model for JSON matching ``schema``; ``validate`` turns it into the result or raises. One retry."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    last_error = ""
    for _ in range(3):
        if last_error:
            messages.append({"role": "user", "content": f"Your previous answer was rejected: {last_error}. Try again."})
        try:
            return validate(_complete(settings, messages, schema, name, http))
        except (ActionInvalid, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            last_error = str(exc) or exc.__class__.__name__
    raise ActionInvalid(last_error)


NUMBER = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(k|m|bn|thousand|million)?\b", re.IGNORECASE)
SCALE = {"k": 1_000, "thousand": 1_000, "m": 1_000_000, "million": 1_000_000, "bn": 1_000_000_000}


def stated_numbers(text: str) -> set[float]:
    """Every number the person wrote, with "42k" and "€1.2m" read as they mean them."""
    found: set[float] = set()
    for digits, suffix in NUMBER.findall(text):
        value = float(digits.replace(",", ""))
        found.add(value)
        if suffix:
            found.add(value * SCALE[suffix.lower()])
    return found


def is_stated(value: float, stated: set[float]) -> bool:
    return any(abs(value - s) < 0.005 * max(1.0, abs(s)) for s in stated)
