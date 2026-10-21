"use client";

import { AssumptionField, LineChart, RunwayGauge } from "@ledgerline/ui";
import { useMemo, useState } from "react";

const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

/**
 * A small, honest version of the forecast for the landing page: the sample joinery's cash, burn and working
 * capital, with three drivers a visitor can move. The real app runs the full three-statement model.
 */
function simulate(hires: number, debtorDays: number, growthPct: number) {
  const startCash = 412_300;
  const baseRevenue = 228_900;
  const margin = 0.42;
  const fixedOutflow = 29_400; // base-case net outflow a month, before growth and hires
  const hireCost = (67_500 / 12) * 1.1115;
  let cash = startCash;
  let debtors = (baseRevenue * 41) / 30;
  const path: number[] = [];
  let runway: number | null = null;
  for (let t = 1; t <= 24; t++) {
    const revenue = baseRevenue * (1 + growthPct / 100) ** t;
    const newDebtors = (revenue * debtorDays) / 30;
    const flow = -fixedOutflow + margin * (revenue - baseRevenue) - (t >= 4 ? hires * hireCost : 0) - (newDebtors - debtors);
    debtors = newDebtors;
    const previous = cash;
    cash += flow;
    path.push(Math.round(cash));
    if (runway === null && cash < 0) runway = t - 1 + previous / (previous - cash);
  }
  return { path, runway };
}

export function WhatIf() {
  const [hires, setHires] = useState(2);
  const [debtorDays, setDebtorDays] = useState(41);
  const [growth, setGrowth] = useState(0);
  const base = useMemo(() => simulate(0, 41, 0), []);
  const now = useMemo(() => simulate(hires, debtorDays, growth), [hires, debtorDays, growth]);
  const months = now.runway ?? 24;
  const cashOut = now.runway === null ? null : MONTHS[Math.min(23, Math.floor(now.runway))] + (now.runway >= 3 ? " 27" : " 26");
  return (
    <div className="lp-whatif">
      <div className="lp-whatif-controls">
        <div className="ll-eyebrow">Kestrel Joinery · sample company</div>
        <AssumptionField id="wi-hires" label="Engineers hired in January" min={0} max={6} step={1} unit="people" defaultValue={2} base={0} onChange={setHires} help="€67,500 each, plus 11.15% employer PRSI." />
        <AssumptionField id="wi-dd" label="Debtor days" min={15} max={90} step={1} unit="days" defaultValue={41} base={41} onChange={setDebtorDays} help="How long customers take to pay." />
        <AssumptionField id="wi-growth" label="Revenue growth a month" min={-3} max={5} step={0.5} unit="%" defaultValue={0} base={0} onChange={setGrowth} help="Compound, from September's €228,900." />
      </div>
      <div className="lp-whatif-out">
        <div className="lp-whatif-top">
          <RunwayGauge months={months} size={210} cashOut={cashOut ?? "Beyond 2 years"} compare={base.runway ?? 24} compareLabel="Base case" />
          <div className="lp-verdict">
            {now.runway === null ? (
              <>Cash stays <em>positive</em> for the next two years.</>
            ) : (
              <>
                Cash runs out in <em className={now.runway < 12 ? "is-bad" : ""}>{cashOut}</em>, {now.runway < (base.runway ?? 24) ? `${((base.runway ?? 24) - now.runway).toFixed(1)} months sooner than` : `${(now.runway - (base.runway ?? 24)).toFixed(1)} months later than`} the base case.
              </>
            )}
          </div>
        </div>
        <LineChart
          labels={MONTHS.map((m, i) => (i >= 3 && i < 15 ? `${m} 27` : i >= 15 ? `${m} 28` : `${m} 26`))}
          zero
          endLabels
          scenarioArea
          height={230}
          thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]}
          series={[
            { name: "Base case", kind: "forecast", values: base.path },
            { name: "Your scenario", kind: "scenario", values: now.path },
          ]}
        />
      </div>
    </div>
  );
}
