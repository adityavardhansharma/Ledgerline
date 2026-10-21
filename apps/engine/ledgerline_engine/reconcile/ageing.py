"""Age unpaid invoices and bills into the buckets owners recognise."""

from __future__ import annotations

from datetime import date

BUCKETS = [
    ("Not yet due", None, 0),
    ("1–30 days overdue", 1, 30),
    ("31–60 days overdue", 31, 60),
    ("61–90 days overdue", 61, 90),
    ("Over 90 days", 91, None),
]


def age(items: list[dict], as_of: str) -> dict:
    today = date.fromisoformat(as_of)
    out = {}
    for kind in ("receivable", "payable"):
        totals = [0] * len(BUCKETS)
        for item in items:
            if item["kind"] != kind or not item.get("due_date"):
                continue
            overdue = (today - date.fromisoformat(item["due_date"])).days
            for index, (_, low, high) in enumerate(BUCKETS):
                if (low is None and overdue <= 0) or (low is not None and overdue >= low and (high is None or overdue <= high)):
                    totals[index] += int(item["amount_due_cents"])
                    break
        out[kind] = [{"label": label, "value": total} for (label, _, _), total in zip(BUCKETS, totals, strict=True)]
        top = {}
        for item in items:
            if item["kind"] == kind:
                top[item["contact"]] = top.get(item["contact"], 0) + int(item["amount_due_cents"])
        out[f"{kind}Top"] = [{"contact": c, "value": v} for c, v in sorted(top.items(), key=lambda kv: -kv[1])[:5]]
    return out
