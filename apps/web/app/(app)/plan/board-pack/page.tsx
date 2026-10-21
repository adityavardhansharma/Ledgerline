"use client";

import { Badge, Banner, Button, CommentaryCard, EmptyState, FinancialStatement, KpiTile, LineChart, Logo, Panel, SankeyChart } from "@ledgerline/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { monthlySummaryCsv, statementCsv } from "@/lib/csv";
import { useForecast, useScenarios } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import { periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { cashChart, sankeyData } from "@/lib/views";

export default function BoardPackPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const commentary = useQuery(api.commentary.latest, {});
  const draft = useAction(api.commentary.draft);
  const accept = useMutation(api.commentary.accept);
  const { base } = useScenarios();
  const forecast = useForecast(base?.id, snapshot?.version);
  const [drafting, setDrafting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redraft = async () => {
    setDrafting(true);
    setError(null);
    try {
      await draft({});
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*(ConvexError|Uncaught Error): /, "") : "Couldn't draft commentary.");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <AppPage
      active="boardpack"
      title="Board pack"
      subtitle={snapshot ? `${periodLabel(snapshot.asOf)} · ${commentary?.status === "accepted" ? "ready to send" : "draft"}` : undefined}
      breadcrumbs={["Plan", "Board pack"]}
      needsData
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
          <Button variant="primary" icon="download" disabled={commentary?.status !== "accepted"} onClick={() => window.print()}>
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
            {commentary?.status !== "accepted" ? (
              <div className="no-print">
                <Banner tone="info" title="Accept the commentary to export.">
                  Board packs only go out with commentary a person has read and accepted.
                </Banner>
              </div>
            ) : null}
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
              <div className="ll-kpi-strip">
                <KpiTile icon="euro" label="Revenue" value={m.revenue / 100} delta={m.revenueDelta ?? undefined} deltaLabel="vs previous month" />
                <KpiTile icon="trend-up" label="EBITDA" value={m.ebitda / 100} />
                <KpiTile icon="bank" label="Cash" value={m.cash / 100} delta={m.cashDelta ?? undefined} deltaLabel="vs previous month" />
                <KpiTile icon="runway" tone="forecast" label="Runway" value={forecast?.runwayMonths ?? null} format="months" note={forecast && forecast.runwayMonths === null ? "Cash stays positive" : undefined} />
              </div>
              {commentary ? (
                <CommentaryCard
                  paragraphs={commentary.paragraphs}
                  tag={commentary.status === "accepted" ? "Commentary" : "Draft commentary"}
                  meta={commentary.status === "accepted" ? `Accepted by ${commentary.acceptedBy}` : undefined}
                  actions={
                    <span className="ll-row no-print">
                      {commentary.status === "draft" ? (
                        <Button size="sm" variant="primary" icon="check" loading={accepting} onClick={async () => { setAccepting(true); try { await accept({ id: commentary.id }); } finally { setAccepting(false); } }}>
                          Accept
                        </Button>
                      ) : (
                        <Badge tone="positive" icon="check">Accepted</Badge>
                      )}
                      <Button size="sm" variant="ghost" icon="refresh" loading={drafting} onClick={redraft}>Redraft</Button>
                    </span>
                  }
                />
              ) : (
                <div className="ll-panel no-print">
                  <EmptyState icon="sparkle" title="Draft this month's commentary" action={<Button variant="primary" icon="sparkle" loading={drafting} onClick={redraft}>Draft commentary</Button>}>
                    The draft explains your figures in plain English. Every number in it is a citation of a figure Ledgerline computed; the AI never writes one itself.
                  </EmptyState>
                </div>
              )}
              {error ? <Banner tone="negative" title="Commentary wasn't drafted.">{error}</Banner> : null}
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
          </>
        );
      }}
    </AppPage>
  );
}
