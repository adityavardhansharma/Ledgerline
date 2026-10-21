/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import sampleAccounts from "../public/samples/kestrel-accounts.csv?raw";
import sampleJournals from "../public/samples/kestrel-journals.csv?raw";
import { batches, normaliseType, parseAmount, parseCsv, parseDate, readAccounts, readJournals } from "./importCsv";

const CHART = "Code,Name,Type\n090,Bank,Bank\n610,Trade debtors,Current asset\n200,Sales,Revenue\n429,General,Overheads\n";

describe("parseCsv", () => {
  test("handles quotes, embedded commas, newlines and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
});

describe("values", () => {
  test("amounts become exact cents", () => {
    expect(parseAmount("1,234.5")).toBe(123450);
    expect(parseAmount("€0.07")).toBe(7);
    expect(parseAmount("(80.00)")).toBe(-8000);
    expect(parseAmount("-12")).toBe(-1200);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12.345")).toBeNaN();
  });
  test("dates in ISO and day-first forms; impossible dates rejected", () => {
    expect(parseDate("2026-09-30")).toBe("2026-09-30");
    expect(parseDate("30/09/2026")).toBe("2026-09-30");
    expect(parseDate("1-2-2026")).toBe("2026-02-01");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Sep 30")).toBeNull();
  });
  test("account types accept plain words", () => {
    expect(normaliseType("Current liability")).toBe("CURRLIAB");
    expect(normaliseType("cost of sales")).toBe("DIRECTCOSTS");
    expect(normaliseType("bananas")).toBeNull();
  });
});

describe("readAccounts", () => {
  test("infers trade debtors from the name and warns", () => {
    const { accounts, errors, warnings } = readAccounts(CHART);
    expect(errors).toEqual([]);
    expect(accounts.find((a) => a.code === "610")?.systemAccount).toBe("DEBTORS");
    expect(warnings[0]).toMatch(/trade debtors/);
  });
  test("explains missing columns and bad types", () => {
    expect(readAccounts("Code,Name\n1,A\n").errors[0].message).toMatch(/Type/);
    expect(readAccounts("Code,Name,Type\n1,A,Nope\n1,B,Bank\n").errors[0]).toMatchObject({ row: 2 });
  });
});

describe("readJournals", () => {
  const { accounts } = readAccounts(CHART);

  test("groups lines, keeps debit-positive sign and totals", () => {
    const csv = "Journal,Date,Account,Description,Debit,Credit\n1,01/03/2026,610,Invoice,100.00,\n1,01/03/2026,200,Invoice,,100.00\n2,2026-03-20,090,Receipt,100,\n2,2026-03-20,610,Receipt,,100\n";
    const result = readJournals(csv, accounts);
    expect(result.errors).toEqual([]);
    expect(result.journals).toHaveLength(2);
    expect(result.journals[0]).toMatchObject({ xero_journal_id: "csv:1", date: "2026-03-01" });
    expect(result.journals[0].lines.map((l) => l.net_cents)).toEqual([10000, -10000]);
    expect(result).toMatchObject({ lineCount: 4, from: "2026-03-01", to: "2026-03-20", debitCents: 20000 });
  });

  test("a signed amount column works too", () => {
    const result = readJournals("Journal,Date,Account,Amount\nA,2026-01-05,429,50\nA,2026-01-05,090,-50\n", accounts);
    expect(result.errors).toEqual([]);
    expect(result.journals[0].journal_number).toBe(1);
  });

  test("unbalanced journals, unknown accounts and mixed dates are reported, not stored", () => {
    const csv = "Journal,Date,Account,Debit,Credit\n1,2026-01-01,090,10,\n1,2026-01-01,200,,9.99\n2,2026-01-02,999,5,\n3,2026-01-03,090,1,\n3,2026-01-04,200,,1\n";
    const result = readJournals(csv, accounts);
    expect(result.journals).toEqual([]);
    const messages = result.errors.map((e) => e.message).join(" | ");
    expect(messages).toMatch(/Journal 1 doesn't balance: debits €10.00, credits €9.99/);
    expect(messages).toMatch(/Account 999 isn't in the chart/);
    expect(messages).toMatch(/one date/);
    expect(messages).not.toMatch(/Journal 2 doesn't balance/);
    expect(result.errors).toHaveLength(3);
  });
});

describe("the sample company", () => {
  test("imports cleanly, balances and batches without splitting journals", () => {
    const chart = readAccounts(sampleAccounts);
    expect(chart.errors).toEqual([]);
    expect(chart.warnings).toEqual([]);
    const result = readJournals(sampleJournals, chart.accounts);
    expect(result.errors).toEqual([]);
    expect(result.journals.length).toBeGreaterThan(2000);
    expect(result.journals.some((j) => j.lines.some((l) => l.contact === "Glenmore Developments"))).toBe(true);
    expect(result).toMatchObject({ from: "2021-09-30", to: "2026-09-30" });
    for (const j of result.journals) expect(j.lines.reduce((s, l) => s + l.net_cents, 0)).toBe(0);
    const parts = batches(result.journals, 300);
    expect(parts.flat()).toEqual(result.journals);
    for (const part of parts) expect(part.reduce((s, j) => s + j.lines.length, 0)).toBeLessThanOrEqual(300);
  });
});
