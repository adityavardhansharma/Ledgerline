"use client";

import { Banner, Button, Menu, type MenuItem } from "@ledgerline/ui";
import { useConvex } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { downloadCsvText, euro, toCsv } from "@/lib/csv";
import { exportName, exportPageHtml } from "@/lib/exportHtml";
import { periodLabel } from "@/lib/format";
import { useWorkspace } from "./useWorkspace";

export interface CsvExport {
  label: string;
  /** Returns the CSV text, or null when there's nothing to export yet. */
  build: () => string | null | Promise<string | null>;
}

/**
 * The Export button on every report: spreadsheets as CSV, and the whole page as a self-contained HTML
 * file with its charts.
 */
export function ExportMenu({ title, csv, html = true, disabled }: { title: string; csv: CsvExport[]; html?: boolean; disabled?: boolean }) {
  const workspace = useWorkspace();
  const organisation = workspace?.org.name;
  const asOf = workspace?.org.asOf ?? undefined;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = async (label: string, job: () => Promise<void>) => {
    setOpen(false);
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const items: MenuItem[] = [
    { heading: "Spreadsheet (CSV)" },
    ...csv.map((c) => ({
      label: c.label,
      icon: "download" as const,
      onClick: () =>
        void run(c.label, async () => {
          const text = await c.build();
          if (!text) throw new Error("There's nothing to export yet.");
          downloadCsvText(exportName(c.label, organisation, asOf), text);
        }),
    })),
  ];
  if (html) {
    const basis = asOf ? `Actuals to ${periodLabel(asOf)}` : undefined;
    items.push(
      { divider: true },
      { heading: "Web page" },
      { label: "HTML with charts", icon: "external", onClick: () => void run("html", () => exportPageHtml({ title, organisation, basis, filename: `${exportName(title, organisation, asOf)}.html` })) },
    );
  }

  return (
    <span className="ll-export-menu" ref={ref} data-export="skip">
      <Button icon="download" iconRight="chevron-down" disabled={disabled} loading={Boolean(busy)} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Export
      </Button>
      {open ? <Menu label="Export" items={items} /> : null}
      {error ? (
        <span className="ll-export-error">
          <Banner tone="negative" title="Export failed." onClose={() => setError(null)}>{error}</Banner>
        </span>
      ) : null}
    </span>
  );
}

/** The general ledger and chart of accounts in Ledgerline's import format, so a file round-trips. */
export function useLedgerCsv(): { journals: () => Promise<string | null>; accounts: () => Promise<string | null> } {
  const convex = useConvex();
  return {
    accounts: async () => {
      const chart = await convex.query(api.ledger.chart, {});
      if (!chart.length) return null;
      return toCsv([["Code", "Name", "Type", "System"], ...chart.map((a) => [a.code, a.name, a.type, a.systemAccount])]);
    },
    journals: async () => {
      const rows: (string | number | null)[][] = [];
      let cursor: string | null = null;
      for (;;) {
        const page: Awaited<ReturnType<typeof convex.query<typeof api.ledger.journals>>> = await convex.query(api.ledger.journals, { paginationOpts: { numItems: 400, cursor } });
        for (const j of page.page) {
          for (const l of j.lines) rows.push([j.journalNumber, j.date, l.code, l.description, euro(l.debitCents || null), euro(l.creditCents || null), j.reference, j.sourceType]);
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      if (!rows.length) return null;
      rows.sort((a, b) => Number(a[0]) - Number(b[0]));
      return toCsv([["Journal", "Date", "Account", "Description", "Debit", "Credit", "Reference", "Source"], ...rows]);
    },
  };
}
