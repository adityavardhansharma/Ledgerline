"use client";

import { Banner, Button, CommentaryCard, EmptyState, FinancialStatement, formatMoney, LineChart, Logo, Panel, SankeyChart, Skeleton } from "@ledgerline/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { pctChange, SummaryLine } from "@/components/app/report/Report";
import { BoardCommentary, BoardNotes, CommentaryToolbar, errorText, VersionHistory } from "@/components/app/BoardCommentary";
import type { Section } from "@/convex/commentary";
import { ExportMenu } from "@/components/app/ExportMenu";
import { monthlySummaryCsv, statementCsv } from "@/lib/csv";
import { useForecast, useScenarios } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import { monthName, periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { cashChart, sankeyData } from "@/lib/views";

export default function BoardPackPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const commentary = useQuery(api.commentary.latest, {});
  const draft = useAction(api.commentary.draft);
  const accept = useMutation(api.commentary.accept);
  const { base } = useScenarios();
  const forecast = useForecast(base?.id, snapshot?.version);
  const [busy, setBusy] = useState<Section | "all" | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const write = async (args: { tone?: string; length?: string; section?: Section }) => {
    setBusy(args.section ?? "all");
    setError(null);
    setPaused(false);
    try {
      await draft(args as never);
    } catch (err) {
      setError(errorText(err, "Couldn't draft commentary."));
      setPaused(err instanceof ConvexError && (err.data as { code?: string } | null)?.code === "limit");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppPage
      active="boardpack"
      title="Board pack"
      subtitle={snapshot ? `${periodLabel(snapshot.asOf)} · ${commentary?.status === "accepted" ? "ready to send" : "draft"}` : undefined}
      breadcrumbs={["Plan", "Board pack"]}
      needsData
      overlay={history ? <VersionHistory currentId={commentary?.id ?? null} onClose={() => setHistory(false)} /> : null}
      actions={
        <>
          <ExportMenu
            title={commentary?.status === "accepted" ? "Board pack" : "Board pack (draft)"}
            disabled={!snapshot}
            csv={[
              { label: "Profit and loss", build: () => (snapshot ? statementCsv(snapshot.pnl) : null) },
              { label: "Balance sheet", build: () => (snapshot ? statementCsv(snapshot.balance) : null) },
              { label: "Cash flow", build: () => (snapshot ? statementCsv(snapshot.cashflow) : null) },
              { label: "Monthly summary", build: () => (snapshot ? monthlySummaryCsv(snapshot) : null) },
            ]}
          />
          <Button
            variant="primary"
            icon="download"
            disabled={commentary?.status !== "accepted"}
            title={commentary?.status === "accepted" ? undefined : "Accept the commentary first (button under the commentary)"}
            onClick={() => window.print()}
          >
            Export PDF
          </Button>
        </>
      }
    >
      {(workspace) => {
        if (!snapshot) return null;
        const m = snapshot.measures;
        const chart = cashChart(snapshot, forecast);
        const pnlTotals = snapshot.pnl.rows.filter((r) => r.type === "subtotal" || r.type === "total");
        const monthIndex = snapshot.pnl.columns.findIndex((c) => c.period === snapshot.asOf);
        return (
          <>
            {error ? (
              <div className="no-print">
                <Banner tone={paused ? "warning" : "negative"} title={paused ? (commentary ? "Showing the last draft." : "New drafts are paused.") : "Commentary wasn't drafted."}>
                  {error}
                </Banner>
              </div>
            ) : null}
            <div className="ll-doc">
              <div className="ll-docbar no-print">
                <span className={`ll-docbar-status${commentary?.status === "accepted" ? " is-done" : ""}`} title={commentary?.status === "accepted" ? `Accepted by ${commentary.acceptedBy}. Export the PDF from the top bar.` : "Read it, edit or redraft any section, then accept it to export."}>
                  <span aria-hidden />
                  {commentary?.status === "accepted" ? "Ready to send" : commentary ? "Draft" : "No commentary yet"}
                </span>
                <CommentaryToolbar commentary={commentary} busy={busy === "all"} onDraft={(opts) => void write(opts)} onHistory={() => setHistory(true)} />
                {commentary?.sections && commentary.status === "draft" ? (
                  <Button variant="primary" size="sm" icon="check" loading={accepting} disabled={Boolean(busy)} onClick={async () => { setAccepting(true); try { await accept({ id: commentary.id }); } finally { setAccepting(false); } }}>
                    Accept for the board
                  </Button>
                ) : null}
              </div>
            <div className="ll-board">
              <div className="ll-board-cover">
                <div>
                  <div className="ll-eyebrow">Management accounts</div>
                  <h1>
                    {periodLabel(snapshot.asOf).split(" ")[0]} <em>{snapshot.asOf.slice(0, 4)}</em>
                  </h1>
                  <p>
                    {workspace.org.name} · prepared {new Date().toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })} · {workspace.org.basis} basis, {workspace.org.currency}
                  </p>
                </div>
                <Logo size={30} />
              </div>
              <SummaryLine
                figures={[
                  { label: "Revenue", value: formatMoney(m.revenue / 100), change: m.revenueDelta, changeText: m.revenueDelta === null ? undefined : pctChange(m.revenueDelta), good: "up", note: "on last month" },
                  { label: "EBITDA", value: formatMoney(m.ebitda / 100), note: monthName(snapshot.asOf) },
                  { label: "Cash at bank", value: formatMoney(m.cash / 100), change: m.cashDelta, changeText: m.cashDelta === null ? undefined : pctChange(m.cashDelta), good: "up", note: "on last month" },
                  { label: "Runway", value: forecast ? (forecast.cashOutPeriod ? `${(forecast.runwayMonths ?? 0).toFixed(1)} months` : "24+ months") : "–", note: forecast ? (forecast.cashOutPeriod ? `cash runs out in ${periodLabel(forecast.cashOutPeriod)}` : "cash stays positive") : undefined },
                ]}
              />
              {commentary?.sections ? (
                <>
                  <BoardCommentary commentary={commentary} busy={busy} onRedraft={(section) => void write({ section })} />
                </>
              ) : commentary?.paragraphs ? (
                <CommentaryCard
                  paragraphs={commentary.paragraphs as never}
                  tag="Earlier commentary"
                  meta="Written before board-pack sections. Redraft for headline, outlook, risks and decisions."
                />
              ) : busy === "all" ? (
                <div className="ll-panel"><Skeleton lines={8} /></div>
              ) : (
                <div className="ll-panel no-print">
                  <EmptyState icon="ai" title="Draft this month's commentary" action={<Button variant="primary" icon="sparkle" onClick={() => void write({})}>Draft commentary</Button>}>
                    A headline, performance, cash, outlook, risks, decisions and the questions a board may ask. Every number is a citation of a figure Ledgerline computed; the AI never writes one itself.
                  </EmptyState>
                </div>
              )}
              {snapshot.sankey.links.length ? (
                <Panel title="Where the revenue went" icon="statement">
                  <SankeyChart {...sankeyData(snapshot)} height={340} />
                </Panel>
              ) : null}
              <Panel title="Cash at bank" icon="bank" subtitle="Actuals, then the base case and its likely range">
                <LineChart labels={chart.labels} series={chart.series as never} forecastFrom={chart.forecastFrom} todayLabel="Today" zero endLabels height={240} />
              </Panel>
              <FinancialStatement
                title="Profit and loss summary"
                columns={[{ label: periodLabel(snapshot.asOf), kind: "A" }, { label: "Year to date", kind: "YTD" }]}
                rows={pnlTotals.map((r) => ({ ...r, values: [r.values?.[monthIndex] ?? null, r.values?.at(-1) ?? null].map((v) => (v == null ? null : v / 100)) })) as never}
                drillable={false}
              />
            </div>
                <BoardNotes canRedraft={Boolean(commentary)} busy={busy === "all"} onRedraft={() => void write({})} />
            </div>
          </>
        );
      }}
    </AppPage>
  );
}
