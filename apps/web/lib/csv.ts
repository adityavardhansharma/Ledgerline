import type { Statement } from "./types";

/** Export a statement as CSV, with amounts in major units and negatives as minus signs for spreadsheets. */
export function statementCsv(statement: Statement): string {
  const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["Code", "Account", ...statement.columns.map((c) => c.label)];
  const lines = [header.map(escape).join(",")];
  for (const row of statement.rows) {
    if (row.type === "spacer") continue;
    const values = (row.values ?? []).map((v) => (v === null || v === undefined ? "" : (v / 100).toFixed(2)));
    lines.push([row.code ?? "", row.type === "section" ? (row.label ?? "").toUpperCase() : (row.label ?? ""), ...values].map(escape).join(","));
  }
  return lines.join("\n") + "\n";
}

export function downloadCsv(filename: string, statement: Statement) {
  const blob = new Blob([statementCsv(statement)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
