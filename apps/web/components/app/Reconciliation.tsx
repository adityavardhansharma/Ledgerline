"use client";

import { Button, ReconcileCheck } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MismatchExplainer } from "./ai/Explainers";
import { RailBlock } from "./report/Report";

/** The proof under every statement: Ledgerline's figures against Xero's own reports. */
/** The rail block, only when there is a check against Xero to show (sample and CSV companies have none). */
export function XeroCheck({ report }: { report?: string }) {
  const result = useQuery(api.reports.reconciliation);
  if (!result) return null;
  return (
    <RailBlock title="Checked against Xero">
      <Reconciliation report={report} />
    </RailBlock>
  );
}

export function Reconciliation({ report = "P&L" }: { report?: string }) {
  const result = useQuery(api.reports.reconciliation);
  const sync = useMutation(api.sync.request);
  if (!result) return null;
  const checkedAt = new Date(result.checkedAt).toLocaleString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (result.status === "match") return <ReconcileCheck status="match" report={report} checkedAt={checkedAt} lines={result.accounts} />;
  const first = result.differences?.[0];
  return (
    <div className="ll-stack" style={{ gap: 10 }}>
    <ReconcileCheck
      status="mismatch"
      report={report}
      diff={Math.abs(result.totalDifference) / 100}
      detail={first ? `${first.name}, ${first.period}: Ledgerline ${(first.oursCents / 100).toFixed(2)} against Xero ${(first.xeroCents / 100).toFixed(2)}. Usually a journal posted after the last sync.` : "Some accounts differ from Xero."}
      action={<Button size="sm" icon="refresh" onClick={() => void sync()}>Sync now</Button>}
    />
      <MismatchExplainer />
    </div>
  );
}
