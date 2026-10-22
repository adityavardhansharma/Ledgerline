"use client";

import { AssumptionField, LineChart } from "@ledgerline/ui";
import { useMemo, useState } from "react";
import { TOOLS } from "./aiSamples";

const ROWS = TOOLS.forecast.rows;
const BASE = ROWS.map((r) => r.cash);
const LABELS = ROWS.map((r) => r.label);
const MARGIN = 0.423;
const DEBTOR_DAYS = 48;
const FITTER = (42_000 * 1.1115) / 12; // a year's pay plus employer PRSI, a month

/**
 * The sample joinery's real base-case forecast, with three drivers a visitor can move on top of it. A simplified
 * version of what the app does: there, every change runs the full three-statement model.
 */
function simulate(fitters: number, debtorDays: number, growthPct: number) {
  let extra = 0;
  return ROWS.map((row, i) => {
    const t = i + 1;
    const lift = (1 + growthPct / 100) ** t;
    extra += row.revenue * (lift - 1) * MARGIN - (t >= 4 ? fitters * FITTER : 0);
    const days = DEBTOR_DAYS + (debtorDays - DEBTOR_DAYS) * Math.min(1, t / 3);
    const debtors = (row.revenue * lift * days) / 30 - (row.revenue * DEBTOR_DAYS) / 30;
    return Math.round(BASE[i] + extra - debtors);
  });
}

const euro = (v: number) => `${v < 0 ? "−" : ""}€${Math.abs(Math.round(v)).toLocaleString("en-IE")}`;
const month = (label: string) => label.replace(/ (\d\d)$/, " 20$1");

export function WhatIf() {
  const [fitters, setFitters] = useState(4);
  const [debtorDays, setDebtorDays] = useState(60);
  const [growth, setGrowth] = useState(0);
  const path = useMemo(() => simulate(fitters, debtorDays, growth), [fitters, debtorDays, growth]);
  const low = Math.min(...path);
  const lowAt = LABELS[path.indexOf(low)];
  const out = path.findIndex((v) => v < 0);
  const end = path[path.length - 1];
  const gap = end - BASE[BASE.length - 1];
  return (
    <div className="lp-whatif">
      <div className="lp-whatif-top">
        <div className="lp-whatif-figures">
          <div>
            <span>Lowest cash</span>
            <strong className={low < 0 ? "is-bad" : undefined}>{euro(low)}</strong>
            <small>{month(lowAt)}</small>
          </div>
          <div>
            <span>Cash in September 2028</span>
            <strong className={end < 0 ? "is-bad" : undefined}>{euro(end)}</strong>
            <small>{gap === 0 ? "Same as the base case" : `${euro(Math.abs(gap))} ${gap < 0 ? "below" : "above"} the base case`}</small>
          </div>
        </div>
        <p className="lp-verdict">
          {out >= 0 ? (
            <>
              Cash runs out in <em className="is-bad">{month(LABELS[out])}</em>.
            </>
          ) : (
            <>Cash stays positive for the next two years.</>
          )}
        </p>
      </div>
      <LineChart
        labels={LABELS}
        zero
        endLabels
        scenarioArea
        height={220}
        thresholds={out >= 0 ? [{ value: 0, label: "CASH RUNS OUT", tone: "negative" }] : []}
        series={[
          { name: "Base case", kind: "forecast", values: BASE },
          { name: "Your scenario", kind: "scenario", values: path },
        ]}
      />
      <div className="lp-whatif-controls">
        <AssumptionField id="wi-fitters" label="Fitters hired" min={0} max={10} step={1} unit="people" defaultValue={4} base={0} onChange={setFitters} help="From January, €42,000 a year each." />
        <AssumptionField id="wi-dd" label="Debtor days" min={20} max={90} step={1} unit="days" defaultValue={60} base={DEBTOR_DAYS} onChange={setDebtorDays} help="It's 48 today." />
        <AssumptionField id="wi-growth" label="Growth a month" min={-3} max={4} step={0.5} unit="%" defaultValue={0} base={0} onChange={setGrowth} help="On top of the base case." />
      </div>
    </div>
  );
}
