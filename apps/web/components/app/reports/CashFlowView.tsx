"use client";

import { CalendarHeatmap, FinancialStatement, formatMoney, WaterfallChart } from "@ledgerline/ui";
import type { ComponentProps } from "react";
import { monthName } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { bridgeSteps, statementRows } from "@/lib/views";
import { moneyChange, pctChange, RailBlock, ReportGrid, SummaryLine, Takeaway } from "../report/Report";

type Days = ComponentProps<typeof CalendarHeatmap>["days"];

/** Cash flow: where the month's cash went is the story, so the bridge leads; the statement and the daily bank sit below. */
export function CashFlowView({ snapshot, days }: { snapshot: Snapshot; days: Days | null }) {
  const m = snapshot.measures;
  const month = monthName(snapshot.asOf);
  const change = (snapshot.bridge.at(-1)!.value - snapshot.bridge[0].value) / 100;
  const operations = snapshot.cashflow.rows.find((r) => r.label === "Cash from operations")?.values ?? [];
  const opsYtd = (operations[1] ?? 0) / 100;
  return (
    <>
      <SummaryLine
        figures={[
          { label: "Cash at bank", value: formatMoney(m.cash / 100), change: m.cashDelta, changeText: m.cashDelta === null ? undefined : pctChange(m.cashDelta), good: "up", note: `end of ${month}` },
          { label: `Cash change in ${month}`, value: moneyChange(change), note: `profit was ${formatMoney(m.netProfit / 100, { compact: true })}` },
          { label: "Cash from operations", value: formatMoney(opsYtd), note: "year to date" },
          { label: "Average monthly movement", value: moneyChange(m.burn / 100), note: "last three months" },
        ]}
      />
      <Takeaway>{takeaway(snapshot, change)}</Takeaway>
      <section className="ll-report-hero">
        <h2>Where {month}&apos;s cash went</h2>
        <WaterfallChart steps={bridgeSteps(snapshot)} height={300} />
      </section>
      <ReportGrid
        main={<FinancialStatement title="Statement of cash flows" columns={snapshot.cashflow.columns} rows={statementRows(snapshot.cashflow) as never} drillable={false} />}
        rail={
          <RailBlock title="Every day in the bank" aside={<small className="ll-muted">last six months</small>}>
            {days && days.length ? <CalendarHeatmap cell={7} days={days} /> : <p className="ll-muted">No bank movements yet.</p>}
          </RailBlock>
        }
      />
    </>
  );
}

/** "Profit of €28k became a cash fall of €50k: €71k went into what customers owe." */
function takeaway(snapshot: Snapshot, change: number) {
  const net = snapshot.measures.netProfit / 100;
  const steps = snapshot.bridge.filter((s) => !s.kind && s.label !== "Net profit");
  const biggest = steps.reduce<(typeof steps)[number] | null>((a, s) => (!a || Math.abs(s.value) > Math.abs(a.value) ? s : a), null);
  const head = `A ${net < 0 ? "loss" : "profit"} of ${formatMoney(Math.abs(net), { compact: true })} became a cash ${change < 0 ? "fall" : "rise"} of ${formatMoney(Math.abs(change), { compact: true })}.`;
  if (!biggest) return head;
  const amount = formatMoney(Math.abs(biggest.value) / 100, { compact: true });
  const what = biggest.label.toLowerCase();
  return `${head} The biggest reason: ${what}, which ${biggest.value < 0 ? "took" : "added"} ${amount}.`;
}
