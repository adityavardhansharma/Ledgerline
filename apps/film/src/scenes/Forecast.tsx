import { AssumptionField, LineChart } from "@ledgerline/ui";
import { TOOLS } from "../../../web/components/landing/aiSamples";
import { Aurora, Chapter, Words } from "../lib/fx";
import { easeInOut, expoOut, keys, prog, useT } from "../lib/time";

// The homepage's what-if, on the sample joinery's real base case (components/landing/WhatIf.tsx), with the drivers
// moved by the film instead of a visitor.
const ROWS = TOOLS.forecast.rows;
const BASE = ROWS.map((r) => r.cash);
const LABELS = ROWS.map((r) => r.label);
const MARGIN = 0.423;
const DEBTOR_DAYS = 48;
const FITTER = (42_000 * 1.1115) / 12;

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

/** 72.5–83s: hire four fitters, let customers pay late, watch the cash run out, then fix it. */
export function Forecast() {
  const t = useT();
  const fitters = Math.round(keys(t, [[1.6, 0], [3.0, 4]], easeInOut));
  const debtorDays = Math.round(keys(t, [[3.4, 48], [5.4, 82], [6.6, 82], [8.0, 38]], easeInOut));
  const growth = Math.round(keys(t, [[6.6, 0], [8.0, 1.5]], easeInOut) * 2) / 2;
  const path = simulate(fitters, debtorDays, growth);
  const low = Math.min(...path);
  const lowAt = LABELS[path.indexOf(low)];
  const outAt = path.findIndex((v) => v < 0);
  const end = path[path.length - 1];
  const gap = end - BASE[BASE.length - 1];
  const danger = outAt >= 0;
  const card = prog(t, 0.6, 1.5, expoOut);
  const out = prog(t, 10, 10.5);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out }}>
      <Aurora strength={0.8} hue={danger ? "negative" : "forecast"} />
      <div className="fc-red" style={{ opacity: danger ? 0.5 + Math.sin(t * 8) * 0.1 : 0 }} />
      <Chapter n="05" name="Forecast" at={0} />
      <div className="fc-head">
        <div className="t-big">
          <Words text="Hire four fitters." at={0.1} stagger={0.08} />{" "}
          <Words text="*Watch the cash move.*" at={0.6} stagger={0.08} />
        </div>
      </div>
      <div className="fc-pos" style={{ opacity: card, transform: `translateY(${(1 - card) * 120}px) rotateX(${(1 - card) * 20}deg)` }}>
        <div className="fc-zoom">
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
                {danger ? (
                  <>
                    Cash runs out in <em className="is-bad">{month(LABELS[outAt])}</em>.
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
              height={240}
              thresholds={danger ? [{ value: 0, label: "CASH RUNS OUT", tone: "negative" }] : []}
              series={[
                { name: "Base case", kind: "forecast", values: BASE },
                { name: "Your scenario", kind: "scenario", values: path },
              ]}
            />
            <div className="lp-whatif-controls">
              <AssumptionField id="fc-fitters" label="Fitters hired" min={0} max={10} step={1} unit="people" value={fitters} base={0} help="From January, €42,000 a year each." />
              <AssumptionField id="fc-dd" label="Debtor days" min={20} max={90} step={1} unit="days" value={debtorDays} base={DEBTOR_DAYS} help="It's 48 today." />
              <AssumptionField id="fc-growth" label="Growth a month" min={-3} max={4} step={0.5} unit="%" value={growth} base={0} help="On top of the base case." />
            </div>
          </div>
        </div>
      </div>
      <div className="fc-foot t-mono" style={{ opacity: prog(t, 8.2, 8.8) }}>
        In the app, every change runs a full three-statement forecast · Assets − liabilities = equity, every month
      </div>
    </div>
  );
}
