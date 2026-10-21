"""Money helpers.

Money crosses every boundary as integer cents. Inside the engine it is a ``Decimal``.
Floats never touch money.
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation

CENT = Decimal("0.01")
ZERO = Decimal("0")


def to_decimal(value: str | int | float | Decimal | None) -> Decimal:
    """Parse an amount from Xero (strings or numbers) into an exact Decimal."""
    if value is None or value == "":
        return ZERO
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        # Xero's JSON numbers arrive as floats; go through repr to keep the written digits.
        value = repr(value)
    try:
        return Decimal(str(value).replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError(f"not an amount: {value!r}") from exc


def to_cents(value: Decimal) -> int:
    """Round half-even to the cent and return an integer number of cents."""
    return int((value.quantize(CENT, rounding=ROUND_HALF_EVEN) * 100).to_integral_value())


def from_cents(cents: int) -> Decimal:
    return (Decimal(cents) / 100).quantize(CENT)


def round_money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)
