"use client";

import { Banner, Breadcrumbs, Drawer, Icon, LedgerTable, Skeleton } from "@ledgerline/ui";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Activity } from "@/convex/ledger";
import { money, periodLabel } from "@/lib/format";
import { ExplainFigure } from "./ai/Explainers";
import { useWorkspace } from "./useWorkspace";

export interface DrillTarget {
  accountId: string;
  label: string;
  code?: string;
  period: string;
  value: number | null;
}

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * What lies behind one figure. With journals (journal access, or imported files) it's the journal lines; a
 * Xero connection without journal access shows the invoices, bills, payments, bank transactions and manual
 * journals instead, read from Xero on demand. Either way the lines add up to the figure.
 */
export function DrillDrawer({ target, onClose }: { target: DrillTarget; onClose: () => void }) {
  const workspace = useWorkspace();
  const fromDocuments = workspace?.connection?.mode === "reports" && workspace.org.source !== "csv" && workspace.org.source !== "sample";
  return fromDocuments ? <DocumentsDrawer target={target} onClose={onClose} /> : <JournalDrawer target={target} onClose={onClose} />;
}

function eyebrow(target: DrillTarget) {
  return `${target.code ? `${target.code} · ` : ""}${target.label} · ${periodLabel(target.period)}`;
}

function JournalDrawer({ target, onClose }: { target: DrillTarget; onClose: () => void }) {
  const data = useQuery(api.ledger.lines, { xeroAccountId: target.accountId, period: target.period });
  const lines = data?.lines ?? [];
  const debit = lines.reduce((s, l) => s + l.debitCents, 0);
  const credit = lines.reduce((s, l) => s + l.creditCents, 0);
  return (
    <Drawer
      eyebrow={eyebrow(target)}
      title={data ? `${target.value !== null ? money(Math.round(target.value * 100)) : "–"} from ${lines.length} journal line${lines.length === 1 ? "" : "s"}` : "Loading journal lines"}
      subtitle={lines.length ? `Journals ${lines[0].journalNumber} to ${lines[lines.length - 1].journalNumber}` : undefined}
      onClose={onClose}
      footer={
        <span className="ll-row ll-muted" style={{ fontSize: 13 }}>
          <Icon name="check" size={14} /> Every journal balances; the net of these lines is the figure in the statement
        </span>
      }
    >
      <Breadcrumbs items={["Statement", `${target.code ? `${target.code} · ` : ""}${target.label}`, periodLabel(target.period)]} />
      {lines.length ? <ExplainFigure accountId={target.accountId} period={target.period} label={target.label} /> : null}
      {data === undefined ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <LedgerTable
            hide={["account", "contact"]}
            lines={lines.map((l) => ({
              date: fmtDate(l.date),
              journal: `JNL-${String(l.journalNumber).padStart(6, "0")}`,
              code: data?.account?.code ?? "",
              account: data?.account?.name ?? "",
              description: [l.reference, l.description].filter(Boolean).join(" · ") || l.sourceType,
              debit: l.debitCents / 100,
              credit: l.creditCents / 100,
            }))}
          />
          {lines.length >= 500 ? <Banner tone="info">Showing the first 500 lines.</Banner> : null}
          <Banner tone="info">
            Debits {money(debit, { decimals: 2 })} less credits {money(credit, { decimals: 2 })} net to {money(debit - credit, { decimals: 2 })} on the account.
          </Banner>
        </>
      )}
    </Drawer>
  );
}

type Loaded = (Activity & { stale?: boolean; error?: string }) | null;

function DocumentsDrawer({ target, onClose }: { target: DrillTarget; onClose: () => void }) {
  const fetchActivity = useAction(api.ledger.activity);
  const [data, setData] = useState<Loaded | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setData(undefined);
    fetchActivity({ xeroAccountId: target.accountId, period: target.period })
      .then((result) => live && setData(result))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [fetchActivity, target.accountId, target.period]);

  const lines = data?.lines ?? [];
  const other = data?.unexplained_cents ?? 0;
  const rows = lines.map((l) => ({
    date: fmtDate(l.date),
    journal: [l.source, l.reference].filter(Boolean).join(" "),
    code: target.code ?? "",
    account: target.label,
    description: [l.contact, l.description].filter(Boolean).join(" · ") || l.source,
    debit: l.net_cents > 0 ? l.net_cents / 100 : 0,
    credit: l.net_cents < 0 ? -l.net_cents / 100 : 0,
  }));
  if (data && other) {
    rows.push({
      date: "–",
      journal: "Other postings",
      code: target.code ?? "",
      account: target.label,
      description: "Posted outside invoices, bills, payments, bank transactions and manual journals",
      debit: other > 0 ? other / 100 : 0,
      credit: other < 0 ? -other / 100 : 0,
    });
  }

  return (
    <Drawer
      eyebrow={eyebrow(target)}
      title={data === undefined ? "Reading transactions from Xero" : `${target.value !== null ? money(Math.round(target.value * 100)) : "–"} from ${lines.length} transaction${lines.length === 1 ? "" : "s"}`}
      subtitle={data?.fetchedAt ? `Read from Xero at ${new Date(data.fetchedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}` : undefined}
      onClose={onClose}
      footer={
        <span className="ll-row ll-muted" style={{ fontSize: 13 }}>
          <Icon name="check" size={14} /> These lines, with any other postings, add up to the figure in the statement
        </span>
      }
    >
      <Breadcrumbs items={["Statement", `${target.code ? `${target.code} · ` : ""}${target.label}`, periodLabel(target.period)]} />
      {data && lines.length ? <ExplainFigure accountId={target.accountId} period={target.period} label={target.label} /> : null}
      {data === undefined ? (
        <Skeleton lines={6} />
      ) : data === null ? (
        <Banner tone="negative" title="Couldn't read Xero.">Try again in a moment.</Banner>
      ) : (
        <>
          {data.error ? (
            <Banner tone={data.stale ? "warning" : "negative"} title={data.stale ? "Showing the last copy read." : "Transactions unavailable."}>
              {data.error}
            </Banner>
          ) : null}
          <LedgerTable hide={["account", "contact"]} lines={rows} />
          {other ? (
            <Banner tone="info" title="Why some postings aren't itemised.">
              Xero shares individual journals only with apps it has approved for journal access. {money(Math.abs(other), { decimals: 2 })} on this account came from
              postings such as depreciation from fixed assets, payroll, conversion balances or bank transfers.
            </Banner>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
