from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from ledgerline_engine.money import from_cents, to_cents, to_decimal


def test_parses_xero_values():
    assert to_decimal("1,234.50") == Decimal("1234.50")
    assert to_decimal(48600.0) == Decimal("48600.0")
    assert to_decimal(None) == Decimal("0")
    assert to_decimal("") == Decimal("0")


def test_rejects_garbage():
    with pytest.raises(ValueError):
        to_decimal("twelve")


def test_half_even_rounding():
    assert to_cents(Decimal("0.125")) == 12
    assert to_cents(Decimal("0.135")) == 14
    assert to_cents(Decimal("-2150.00")) == -215000


@given(st.integers(min_value=-10**12, max_value=10**12))
def test_cents_round_trip(cents):
    assert to_cents(from_cents(cents)) == cents
