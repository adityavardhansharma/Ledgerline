"""The sample company shipped with the web app must always build into statements that tie out."""

import csv
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sample_company", ROOT / "scripts" / "sample_company.py")
sample = importlib.util.module_from_spec(spec)
sys.modules["sample_company"] = sample
spec.loader.exec_module(sample)


def test_sample_builds_and_never_goes_overdrawn():
    checked = sample.check(sample.generate())
    assert checked["lowest_cash"] > 0
    assert checked["result"]["asOf"] == "2026-09"


def test_shipped_csv_matches_the_generator():
    shipped = ROOT.parent / "web" / "public" / "samples" / "kestrel-journals.csv"
    with shipped.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert rows == [{k: str(v) for k, v in row.items()} for row in sample.to_rows(sample.generate())]
