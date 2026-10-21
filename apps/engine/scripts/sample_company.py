"""Generate Kestrel Joinery Ltd, the sample company, as the two CSV files Ledgerline imports.

    python scripts/sample_company.py ../web/public/samples

Twenty-four months of double-entry bookkeeping for an Irish joinery (October 2024 to September 2026):
sales invoices with VAT, supplier bills, customer receipts on realistic terms, payroll with PAYE, VAT returns,
rent, depreciation, a bank loan, corporation tax, prepaid insurance and a machine bought in April 2026. The
output is deterministic and is checked against the statements builder before it is written.
"""

from __future__ import annotations

import csv
import random
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

ACCOUNTS = [
    # code, name, type, system account
    ("090", "Bank: business current account", "BANK", ""),
    ("610", "Trade debtors", "CURRENT", "DEBTORS"),
    ("620", "Prepayments", "PREPAYMENT", ""),
    ("630", "Stock: timber and fittings", "INVENTORY", ""),
    ("710", "Plant and machinery", "FIXED", ""),
    ("711", "Plant and machinery: depreciation", "FIXED", ""),
    ("720", "Vans", "FIXED", ""),
    ("721", "Vans: depreciation", "FIXED", ""),
    ("800", "Trade creditors", "CURRLIAB", "CREDITORS"),
    ("820", "VAT", "CURRLIAB", "GST"),
    ("825", "PAYE and PRSI", "CURRLIAB", ""),
    ("830", "Corporation tax", "CURRLIAB", ""),
    ("900", "Bank loan", "TERMLIAB", ""),
    ("960", "Retained earnings", "EQUITY", "RETAINEDEARNINGS"),
    ("970", "Share capital", "EQUITY", ""),
    ("200", "Sales: fitted kitchens", "REVENUE", ""),
    ("210", "Sales: doors and joinery", "REVENUE", ""),
    ("310", "Timber and materials", "DIRECTCOSTS", ""),
    ("320", "Subcontract fitters", "DIRECTCOSTS", ""),
    ("400", "Marketing", "OVERHEADS", ""),
    ("412", "Accountancy and legal", "OVERHEADS", ""),
    ("429", "General", "OVERHEADS", ""),
    ("469", "Rent and rates", "OVERHEADS", ""),
    ("477", "Wages and salaries", "WAGESEXPENSE", ""),
    ("485", "Software", "OVERHEADS", ""),
    ("416", "Depreciation", "DEPRECIATN", ""),
    ("437", "Interest paid", "EXPENSE", ""),
    ("500", "Corporation tax expense", "EXPENSE", ""),
]

CUSTOMERS = [
    "Harbour Row Apartments",
    "Cuala Builders Ltd",
    "Glenmore Developments",
    "Seaview Hotel",
    "Ashgrove Homes",
    "M. Kavanagh",
    "Ó Briain residence",
    "Riverside Dental",
    "Fitzgerald & Daly Architects",
    "Ballyboden Parish Hall",
    "Hollybank Nursing Home",
    "S. Whelan",
]
TIMBER = ["Liffey Timber Supplies", "Burren Hardware", "Shannon Stone Worktops", "Kilkenny Glass", "Atlantic Ironmongery"]
FITTERS = ["M. Doyle Fitting", "Corrib Installations", "P. Nolan Carpentry"]

# Revenue in September 2026 lands near the design system's €228,900; growth 1.4% a month with a joinery's year.
SEASON = {1: 0.88, 2: 0.95, 3: 1.04, 4: 1.05, 5: 1.06, 6: 1.02, 7: 0.96, 8: 0.92, 9: 1.03, 10: 1.05, 11: 1.03, 12: 0.85}
FIRST = date(2024, 10, 1)
LAST = date(2026, 9, 30)
VAT_SALES = 0.135
VAT_PURCHASES = 0.23


@dataclass
class Journal:
    date: date
    description: str
    reference: str
    source: str
    lines: list[tuple[str, int, str]] = field(default_factory=list)  # (account code, net cents, line description)

    def add(self, code: str, cents: int, text: str = "") -> Journal:
        self.lines.append((code, cents, text or self.description))
        return self


def months(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def month_end(d: date) -> date:
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1) - timedelta(days=1)


def cents(euros: float) -> int:
    return int(round(euros * 100))


def workday(d: date) -> date:
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def generate(seed: int = 7) -> list[Journal]:
    rng = random.Random(seed)
    js: list[Journal] = []

    # Opening balances at 30 September 2024. Equity is the balancing figure.
    opening = {
        "090": cents(258_400),
        "610": cents(296_000),
        "620": cents(0),
        "630": cents(84_500),
        "710": cents(182_000),
        "711": -cents(61_200),
        "720": cents(64_000),
        "721": -cents(21_300),
        "800": -cents(118_700),
        "820": -cents(17_900),
        "825": -cents(15_400),
        "830": -cents(14_800),
        "900": -cents(60_000),
        "970": -cents(100),
    }
    opening["960"] = -sum(opening.values())
    j = Journal(date(2024, 9, 30), "Opening balances", "OB-2024", "MANJOURNAL")
    for code, value in opening.items():
        if value:
            j.add(code, value, "Opening balance")
    js.append(j)

    # Opening debtors, creditors and taxes are settled in October and November 2024.
    for share, day in ((0.55, 15), (0.45, 12)):
        month = 10 if day == 15 else 11
        js.append(
            Journal(workday(date(2024, month, day)), "Receipts: opening debtors", "Lodgement", "ACCRECPAYMENT")
            .add("090", round(opening["610"] * share))
            .add("610", -round(opening["610"] * share))
        )
    js.append(
        Journal(workday(date(2024, 10, 20)), "Payments: opening creditors", "BACS run", "ACCPAYPAYMENT")
        .add("800", -opening["800"])
        .add("090", opening["800"])
    )
    js.append(
        Journal(workday(date(2024, 10, 19)), "VAT return: Jul–Aug 2024", "ROS", "CASHPAID")
        .add("820", -opening["820"])
        .add("090", opening["820"])
    )
    js.append(
        Journal(workday(date(2024, 10, 14)), "PAYE and PRSI: September", "ROS", "CASHPAID")
        .add("825", -opening["825"])
        .add("090", opening["825"])
    )
    js.append(
        Journal(workday(date(2024, 10, 23)), "Corporation tax: balance for 2023", "ROS", "CASHPAID")
        .add("830", -opening["830"])
        .add("090", opening["830"])
    )

    invoice_no = 1180
    bill_no = 0
    machine_capex = cents(48_000)
    for index, m in enumerate(months(FIRST, LAST)):
        end = month_end(m)
        trend = 165_000 * 1.014**index * SEASON[m.month] * rng.uniform(0.97, 1.03)
        sales_target = cents(trend)
        net_sales = 0

        # Sales invoices: five to nine a month, about two thirds kitchens.
        count = rng.randint(5, 9)
        weights = [rng.uniform(0.5, 1.5) for _ in range(count)]
        for k, w in enumerate(weights):
            net = round(sales_target * w / sum(weights)) if k < count - 1 else sales_target - net_sales
            net_sales += net
            kitchens = rng.random() < 0.66
            customer = rng.choice(CUSTOMERS)
            vat = round(net * VAT_SALES)
            invoice_no += 1
            issued = workday(m + timedelta(days=rng.randint(0, end.day - 3)))
            ref = f"INV-{invoice_no}"
            label = f"{customer}: {'fitted kitchen' if kitchens else 'doors and joinery'}"
            js.append(
                Journal(issued, label, ref, "ACCREC")
                .add("610", net + vat)
                .add("200" if kitchens else "210", -net)
                .add("820", -vat, f"VAT on {ref}")
            )
            paid = workday(issued + timedelta(days=rng.choice([14, 21, 30, 30, 45, 45, 60, 75])))
            if paid <= LAST:
                js.append(
                    Journal(paid, f"Receipt: {customer}", ref, "ACCRECPAYMENT").add("090", net + vat).add("610", -(net + vat))
                )

        # Materials (about 48% of sales) and subcontract fitting (about 10%), on 30 and 14 day terms.
        for code, share, suppliers, terms, parts in (("310", 0.48, TIMBER, 30, 5), ("320", 0.10, FITTERS, 14, 2)):
            total = round(net_sales * share * rng.uniform(0.97, 1.03))
            split = [rng.uniform(0.6, 1.4) for _ in range(parts)]
            done = 0
            for k, s in enumerate(split):
                net = round(total * s / sum(split)) if k < parts - 1 else total - done
                done += net
                bill_no += 1
                supplier = rng.choice(suppliers)
                vat = round(net * VAT_PURCHASES) if code == "310" else 0
                received = workday(m + timedelta(days=rng.randint(0, end.day - 3)))
                ref = f"BILL-{bill_no:04d}"
                j = Journal(received, f"{supplier}: {'materials' if code == '310' else 'fitting'}", ref, "ACCPAY").add(code, net)
                if vat:
                    j.add("820", vat, f"VAT on {ref}")
                js.append(j.add("800", -(net + vat)))
                paid = workday(received + timedelta(days=terms + rng.randint(-3, 6)))
                if paid <= LAST:
                    js.append(
                        Journal(paid, f"Payment: {supplier}", ref, "ACCPAYPAYMENT").add("800", net + vat).add("090", -(net + vat))
                    )

        # Stock count at each quarter end moves a little either way against materials.
        if m.month in (3, 6, 9, 12):
            change = cents(rng.uniform(-6_000, 8_000))
            js.append(
                Journal(end, "Stock count adjustment", f"STK-{m:%Y%m}", "MANJOURNAL").add("630", change).add("310", -change)
            )

        # Payroll on the 25th; PAYE and PRSI to Revenue on the 14th of the next month. A cabinet maker joins in March 2026.
        gross = cents(44_000 if m < date(2026, 3, 1) else 49_200) + cents(rng.uniform(-400, 400))
        paye = round(gross * 0.26)
        js.append(
            Journal(workday(date(m.year, m.month, 25)), f"Payroll: {m:%B %Y}", f"PAY-{m:%Y%m}", "MANJOURNAL")
            .add("477", gross)
            .add("090", -(gross - paye), "Net pay")
            .add("825", -paye, "PAYE, USC and PRSI")
        )
        nxt = month_end(m) + timedelta(days=14)
        if nxt <= LAST:
            js.append(Journal(workday(nxt), f"PAYE and PRSI: {m:%B}", "ROS", "CASHPAID").add("825", paye).add("090", -paye))

        # Overheads paid straight from the bank.
        for day, code, text, amount in (
            (1, "469", "Unit 4, Ballymount: rent", 6_200),
            (3, "485", "Software subscriptions", 2_900 + rng.uniform(-150, 150)),
            (8, "400", "Marketing: online and print", 6_100 * rng.uniform(0.75, 1.25)),
            (12, "412", "Kearney & Co: accountancy", 1_800),
            (17, "429", "General expenses", 1_300 * rng.uniform(0.8, 1.2)),
        ):
            value = cents(amount)
            js.append(
                Journal(workday(date(m.year, m.month, day)), text, "Card" if code != "469" else "Standing order", "CASHPAID")
                .add(code, value)
                .add("090", -value)
            )

        # Insurance paid each January, released monthly through General.
        if m.month == 1:
            js.append(
                Journal(workday(date(m.year, 1, 10)), "Allianz: annual insurance", "DD", "CASHPAID")
                .add("620", cents(9_600))
                .add("090", -cents(9_600))
            )
        if m.year >= 2025:
            js.append(
                Journal(end, "Insurance released", f"PRE-{m:%Y%m}", "MANJOURNAL").add("429", cents(800)).add("620", -cents(800))
            )

        # A CNC router arrives in April 2026 and is paid in May.
        if m == date(2026, 4, 1):
            vat = round(machine_capex * VAT_PURCHASES)
            js.append(
                Journal(date(2026, 4, 9), "Felder Group: CNC router", "BILL-CNC", "ACCPAY")
                .add("710", machine_capex)
                .add("820", vat, "VAT on CNC router")
                .add("800", -(machine_capex + vat))
            )
            js.append(
                Journal(date(2026, 5, 8), "Payment: Felder Group", "BILL-CNC", "ACCPAYPAYMENT")
                .add("800", machine_capex + vat)
                .add("090", -(machine_capex + vat))
            )

        # Depreciation: plant over five years, vans over four.
        plant = cents(182_000) + (machine_capex if m >= date(2026, 4, 1) else 0)
        dep_plant, dep_vans = round(plant / 60), round(cents(64_000) / 48)
        js.append(
            Journal(end, "Depreciation", f"DEP-{m:%Y%m}", "MANJOURNAL")
            .add("416", dep_plant + dep_vans)
            .add("711", -dep_plant, "Plant and machinery")
            .add("721", -dep_vans, "Vans")
        )

        # Loan: €2,000 capital and interest at 9% a year, on the 28th.
        outstanding = cents(60_000) - cents(2_000) * index
        interest = round(outstanding * 0.09 / 12)
        js.append(
            Journal(workday(date(m.year, m.month, 28)), "AIB term loan repayment", "DD", "CASHPAID")
            .add("437", interest)
            .add("900", cents(2_000))
            .add("090", -(interest + cents(2_000)))
        )

    js.sort(key=lambda j: (j.date, j.reference))
    _vat_returns(js)
    _corporation_tax(js)
    js.sort(key=lambda j: (j.date, j.reference))
    return js


def _balance(js: list[Journal], code: str, upto: date) -> int:
    return sum(c for j in js if j.date <= upto for a, c, _ in j.lines if a == code)


def _vat_returns(js: list[Journal]) -> None:
    """Bi-monthly VAT returns, paid on the 19th of the month after each period."""
    for m in months(date(2024, 10, 1), LAST):
        if m.month % 2 == 0:  # periods end in Feb, Apr, Jun, Aug, Oct, Dec
            end = month_end(m)
            due = workday(end + timedelta(days=19))
            if due > LAST:
                continue
            owed = -_balance(js, "820", end)
            if owed > 0:
                label = f"{(end.replace(day=1) - timedelta(days=1)):%b}–{end:%b %Y}"
                js.append(Journal(due, f"VAT return: {label}", "ROS", "CASHPAID").add("820", owed).add("090", -owed))


def _corporation_tax(js: list[Journal]) -> None:
    """Accrue 12.5% of each month's profit; pay the balance in June and November (preliminary tax)."""
    pnl = {c for c, _, t, _ in ACCOUNTS if t in ("REVENUE", "DIRECTCOSTS", "OVERHEADS", "WAGESEXPENSE", "DEPRECIATN", "EXPENSE")}
    for m in months(FIRST, LAST):
        end = month_end(m)
        profit = -sum(c for j in js if m <= j.date <= end for a, c, _ in j.lines if a in pnl)
        accrual = max(0, round(profit * 0.125))
        if accrual:
            js.append(
                Journal(end, "Corporation tax provision", f"CT-{m:%Y%m}", "MANJOURNAL").add("500", accrual).add("830", -accrual)
            )
        if m.month in (6, 11):
            due = workday(date(m.year, m.month, 23))
            owed = -_balance(js, "830", end - timedelta(days=end.day))
            if owed > 0:
                js.append(Journal(due, "Corporation tax: preliminary", "ROS", "CASHPAID").add("830", owed).add("090", -owed))


def to_rows(js: list[Journal]) -> list[dict]:
    rows = []
    for number, j in enumerate(js, start=1):
        assert sum(c for _, c, _ in j.lines) == 0, j
        for code, value, text in j.lines:
            rows.append(
                {
                    "Journal": number,
                    "Date": j.date.isoformat(),
                    "Account": code,
                    "Description": text,
                    "Debit": f"{value / 100:.2f}" if value > 0 else "",
                    "Credit": f"{-value / 100:.2f}" if value < 0 else "",
                    "Reference": j.reference,
                    "Source": j.source,
                }
            )
    return rows


def check(js: list[Journal]) -> dict:
    """Build the statements the way Convex would, so a broken sample never ships."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from ledgerline_engine.statements.build import build_all

    accounts = [
        {"xero_account_id": f"csv:{c}", "code": c, "name": n, "type": t, "account_class": "", "system_account": s}
        for c, n, t, s in ACCOUNTS
    ]
    totals: dict[tuple[str, str], int] = {}
    cash = 0
    lowest = None
    for j in js:
        for code, value, _ in j.lines:
            key = (f"csv:{code}", j.date.strftime("%Y-%m"))
            totals[key] = totals.get(key, 0) + value
            if code == "090":
                cash += value
                lowest = cash if lowest is None else min(lowest, cash)
    assert lowest is not None and lowest > 0, f"bank goes overdrawn: {lowest}"
    balances = [{"xero_account_id": a, "period": p, "net_cents": v} for (a, p), v in totals.items()]
    return {"result": build_all(accounts, balances, 1, "2026-09"), "lowest_cash": lowest}


def write(out: Path) -> None:
    js = generate()
    checked = check(js)
    out.mkdir(parents=True, exist_ok=True)
    with (out / "kestrel-accounts.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Code", "Name", "Type", "System"])
        for code, name, kind, system in ACCOUNTS:
            w.writerow([code, name, kind, system])
    rows = to_rows(js)
    with (out / "kestrel-journals.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    m = checked["result"]["measures"]
    print(f"{len(js)} journals, {len(rows)} lines; lowest cash €{checked['lowest_cash'] / 100:,.0f}")
    print({k: m[k] for k in list(m)[:8]})


if __name__ == "__main__":
    write(Path(sys.argv[1] if len(sys.argv) > 1 else "../web/public/samples"))
