"use client";

import { Banner, Breadcrumbs, Drawer, Icon, LedgerTable, Skeleton } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { money, periodLabel } from "@/lib/format";

export interface DrillTarget {
  accountId: string;
  label: string;
  code?: string;
  period: string;
  value: number | null;
}

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** The journal lines behind one figure. Debits equal credits on every journal; the net equals the cell. */
export function DrillDrawer({ target, onClose }: { target: DrillTarget; onClose: () => void }) {
  const data = useQuery(api.ledger.lines, { xeroAccountId: target.accountId, period: target.period });
  const lines = data?.lines ?? [];
  const debit = lines.reduce((s, l) => s + l.debitCents, 0);
  const credit = lines.reduce((s, l) => s + l.creditCents, 0);
  return (
    <Drawer
      eyebrow={`${target.code ? `${target.code} · ` : ""}${target.label} · ${periodLabel(target.period)}`}
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
