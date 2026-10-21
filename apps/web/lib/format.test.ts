import { describe, expect, it } from "vitest";
import { statementCsv } from "./csv";
import { money, periodLabel } from "./format";

describe("money", () => {
  it("follows accounting conventions", () => {
    expect(money(-3_120_000)).toBe("(€31,200)");
    expect(money(41_230_000, { compact: true })).toBe("€412.3k");
    expect(money(0)).toBe("–");
    expect(money(null)).toBe("–");
    expect(money(4_860_000, { decimals: 2 })).toBe("€48,600.00");
  });

  it("labels periods", () => {
    expect(periodLabel("2026-09")).toBe("Sep 2026");
    expect(periodLabel("2027-01", false)).toBe("Jan");
  });
});

describe("statementCsv", () => {
  it("writes codes, labels and major units, quoting where needed", () => {
    const csv = statementCsv({
      columns: [{ label: "Sep 26" }, { label: "FY 2026" }],
      rows: [
        { type: "section", label: "Trading income" },
        { type: "line", code: "4000", label: "Sales, joinery", values: [22_890_000, 183_410_000] },
        { type: "spacer" },
        { type: "total", label: "Net profit", values: [-2_108_700, null] },
      ],
    });
    expect(csv.split("\n")).toEqual(["Code,Account,Sep 26,FY 2026", ",TRADING INCOME", '4000,"Sales, joinery",228900.00,1834100.00', ",Net profit,-21087.00,", ""]);
  });
});
