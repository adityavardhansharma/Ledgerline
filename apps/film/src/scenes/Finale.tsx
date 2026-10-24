import {
  AgedDebtors,
  BalanceBars,
  BarChart,
  Button,
  CalendarHeatmap,
  demo,
  DonutChart,
  FinancialStatement,
  Icon,
  KpiTile,
  LineChart,
  Logo,
  RunwayGauge,
  SankeyChart,
  ScenarioCard,
  TornadoChart,
  Treemap,
  WaterfallChart,
} from "@ledgerline/ui";
import { memo, type ReactNode } from "react";
import { Aurora, Camera, LedgerRule, Words } from "../lib/fx";
import { clamp, easeInOut, expoOut, keys, prog, useT } from "../lib/time";

const d = demo;
const money = (v: number) => `€${Math.round(v / 1000)}k`;

function Tile({ children, span = 1 }: { children: ReactNode; span?: number }) {
  return <div className={`fi-tile${span > 1 ? ` span-${span}` : ""}`}>{children}</div>;
}

/** Every part of the product at once, the way the app draws it from the sample company's books. */
const Wall = memo(function Wall() {
  return (
    <div className="fi-wall">
      <Tile span={2}>
        <LineChart labels={d.cashChart.labels} series={[{ name: "Cash", kind: "actual", values: d.cashChart.actual }, { name: "Base case", kind: "forecast", values: d.cashChart.base }]} forecastFrom={9} todayLabel="Today" height={230} zero />
      </Tile>
      <Tile>
        <KpiTile icon="euro" label="Revenue, September" value={246281} delta={0.169} deltaLabel="vs Aug" spark={d.revenue} />
      </Tile>
      <Tile>
        <RunwayGauge months={24} max={36} size={210} cashOut="Beyond Sep 2028" />
      </Tile>
      <Tile span={2}>
        <SankeyChart nodes={d.sankey.nodes} links={d.sankey.links} height={260} format={money} />
      </Tile>
      <Tile span={2}>
        <WaterfallChart steps={d.bridge} height={240} />
      </Tile>
      <Tile>
        <DonutChart items={d.opexYtd} size={200} centerLabel="Costs, YTD" />
      </Tile>
      <Tile span={2}>
        <TornadoChart base={d.tornado.base} rows={d.tornado.rows} unit="months" />
      </Tile>
      <Tile>
        <ScenarioCard {...d.scenarios[1]} horizon={24} />
      </Tile>
      <Tile span={2}>
        <FinancialStatement columns={d.columns.slice(6, 10)} rows={d.pnlRows.slice(0, 9).map((r: { values?: number[] }) => ({ ...r, values: r.values?.slice(6, 10) }))} forecastFrom={3} dense />
      </Tile>
      <Tile>
        <AgedDebtors buckets={d.agedDebtors} />
      </Tile>
      <Tile span={2}>
        <CalendarHeatmap days={d.heatmap.slice(0, 120)} cell={16} />
      </Tile>
      <Tile>
        <KpiTile icon="percent" label="Gross margin" value={0.423} format="pct" note="Within its usual range" />
      </Tile>
      <Tile span={2}>
        <BalanceBars assets={d.balanceBars.assets} liabilities={d.balanceBars.liabilities} equity={d.balanceBars.equity} />
      </Tile>
      <Tile span={2}>
        <Treemap items={d.opexYtd} height={220} />
      </Tile>
      <Tile span={2}>
        <BarChart labels={d.months} values={d.revenue} forecastFrom={9} height={220} />
      </Tile>
      <Tile>
        <KpiTile icon="invoice" tone="warning" label="Debtor days" value={48} format="days" note="Up from 42 in June" />
      </Tile>
    </div>
  );
});

const LINES = ["Management accounts.", "Forecasts.", "Board packs.", "*Straight from Xero.*"];

/** 96–110s: the whole product as a landscape, then the promise, the name, and the way in. */
export function Finale() {
  const t = useT();
  const wall = 1 - prog(t, 5.4, 6.0);
  const dolly = keys(t, [[0, 0], [6, 1]], (p) => p);
  const close = prog(t, 5.6, 6.2);
  const end = prog(t, 13.2, 14, easeInOut);
  return (
    <div className="fx-scene" style={{ opacity: 1 - end }}>
      {wall > 0 ? (
        <div className="fx-scene" style={{ opacity: wall * prog(t, 0, 0.6) }}>
          <Camera x={-dolly * 420 + 200} y={dolly * -260 + 120} scale={0.92 + dolly * 0.12} rx={48} rz={-16} origin="50% 50%">
            <div className="fi-wall-pos">
              <Wall />
            </div>
          </Camera>
          <div className="fi-shade" />
          <div className="fi-lines">
            {LINES.map((line, i) => (
              <div key={line} className="t-huge">
                <Words text={line} at={0.5 + i * 0.95} stagger={0.07} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {close > 0 ? (
        <div className="fx-scene" style={{ opacity: close }}>
          <Aurora strength={prog(t, 6, 8)} />
          <div className="t-center">
            <div className="t-huge fi-final">
              <Words text="Know your cash" at={6.0} stagger={0.09} />
              <br />
              <Words text="*every morning.*" at={6.6} stagger={0.14} dur={0.9} />
            </div>
            <div className="fi-logo" style={{ opacity: prog(t, 8.2, 8.9), transform: `translateY(${(1 - prog(t, 8.2, 9.2, expoOut)) * 30}px)` }}>
              <Logo size={64} />
            </div>
            <div className="fi-ctas" style={{ opacity: prog(t, 8.8, 9.4), transform: `translateY(${(1 - prog(t, 8.8, 9.8, expoOut)) * 30}px)` }}>
              <Button variant="primary" size="lg" iconRight="arrow-right">
                Connect Xero
              </Button>
              <Button size="lg" icon="upload">
                Upload CSV
              </Button>
            </div>
            <ul className="fi-proof" style={{ opacity: prog(t, 9.6, 10.3) }}>
              <li>
                <Icon name="lock" size={17} /> Read-only Xero access
              </li>
              <li>
                <Icon name="reconcile" size={17} /> Matches Xero to the cent
              </li>
              <li>
                <Icon name="clock" size={17} /> First report in about two minutes
              </li>
            </ul>
            <div className="fi-free t-mono" style={{ opacity: prog(t, 10.4, 11) }}>
              Start free · every report, forecast and board pack on every plan
            </div>
            <div className="fi-rule">
              <LedgerRule p={prog(t, 10.6, 12.2, expoOut)} double={prog(t, 11.6, 12.4, expoOut)} width={900} glow={0.8} />
            </div>
          </div>
        </div>
      ) : null}
      <div className="fi-black" style={{ opacity: clamp(end) }} />
    </div>
  );
}
