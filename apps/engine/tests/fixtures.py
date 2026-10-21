"""A small, realistic chart of accounts and journal generator shared by the tests."""

from __future__ import annotations

ACCOUNTS = [
    {"xero_account_id": "bank", "code": "1200", "name": "Bank: current account", "type": "BANK", "account_class": "ASSET"},
    {
        "xero_account_id": "debtors",
        "code": "1100",
        "name": "Trade debtors",
        "type": "CURRENT",
        "account_class": "ASSET",
        "system_account": "DEBTORS",
    },
    {"xero_account_id": "stock", "code": "1001", "name": "Stock", "type": "INVENTORY", "account_class": "ASSET"},
    {"xero_account_id": "plant", "code": "0710", "name": "Plant and machinery", "type": "FIXED", "account_class": "ASSET"},
    {
        "xero_account_id": "creditors",
        "code": "2100",
        "name": "Trade creditors",
        "type": "CURRLIAB",
        "account_class": "LIABILITY",
        "system_account": "CREDITORS",
    },
    {
        "xero_account_id": "vat",
        "code": "2201",
        "name": "VAT",
        "type": "CURRLIAB",
        "account_class": "LIABILITY",
        "system_account": "GST",
    },
    {"xero_account_id": "ct", "code": "2300", "name": "Corporation tax", "type": "CURRLIAB", "account_class": "LIABILITY"},
    {"xero_account_id": "loan", "code": "2900", "name": "Bank loan", "type": "TERMLIAB", "account_class": "LIABILITY"},
    {"xero_account_id": "capital", "code": "3000", "name": "Share capital", "type": "EQUITY", "account_class": "EQUITY"},
    {"xero_account_id": "sales", "code": "4000", "name": "Sales", "type": "REVENUE", "account_class": "REVENUE"},
    {"xero_account_id": "cogs", "code": "5000", "name": "Cost of sales", "type": "DIRECTCOSTS", "account_class": "EXPENSE"},
    {
        "xero_account_id": "wages",
        "code": "6100",
        "name": "Wages and salaries",
        "type": "WAGESEXPENSE",
        "account_class": "EXPENSE",
    },
    {"xero_account_id": "rent", "code": "6200", "name": "Rent and rates", "type": "OVERHEADS", "account_class": "EXPENSE"},
    {"xero_account_id": "dep", "code": "7100", "name": "Depreciation", "type": "DEPRECIATN", "account_class": "EXPENSE"},
    {"xero_account_id": "interest", "code": "7200", "name": "Interest paid", "type": "EXPENSE", "account_class": "EXPENSE"},
    {
        "xero_account_id": "taxexp",
        "code": "8200",
        "name": "Corporation tax expense",
        "type": "EXPENSE",
        "account_class": "EXPENSE",
    },
]


def month_journals(period: str, sales: int, rng=None) -> list[list[tuple[str, int]]]:
    """Balanced journals (lists of (account, net_cents)) for one month of a small joinery."""
    cogs = sales * 58 // 100
    collected = sales * 90 // 100
    return [
        [("debtors", sales), ("sales", -sales)],
        [("cogs", cogs), ("creditors", -cogs)],
        [("bank", collected), ("debtors", -collected)],
        [("creditors", cogs * 95 // 100), ("bank", -(cogs * 95 // 100))],
        [("wages", 4_920_000), ("bank", -4_920_000)],
        [("rent", 620_000), ("bank", -620_000)],
        [("dep", 310_000), ("plant", -310_000)],
        [("interest", 60_000), ("loan", 140_000), ("bank", -200_000)],
    ]


def opening_journals() -> list[list[tuple[str, int]]]:
    lines = [
        ("bank", 50_000_000),
        ("plant", 16_150_000),
        ("loan", -13_800_000),
        ("debtors", 10_000_000),
        ("creditors", -12_340_000),
        ("stock", 7_030_000),
    ]
    return [lines + [("capital", -sum(v for _, v in lines))]]


def balances_from(journals_by_period: dict[str, list[list[tuple[str, int]]]]) -> list[dict]:
    totals: dict[tuple[str, str], int] = {}
    for period, journals in journals_by_period.items():
        for journal in journals:
            assert sum(v for _, v in journal) == 0, journal
            for account, value in journal:
                totals[(account, period)] = totals.get((account, period), 0) + value
    return [{"xero_account_id": a, "period": p, "net_cents": v} for (a, p), v in totals.items()]
