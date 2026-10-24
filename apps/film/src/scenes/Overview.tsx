import { AppShell, Button, HeroMetric, KpiTile, LineChart, PeriodPicker, StatusPill } from "@ledgerline/ui";
import { memo } from "react";
import { HeroChat } from "../../../web/components/landing/AiShowcase";
import { HISTORY, TOOLS } from "../../../web/components/landing/aiSamples";
import { Aurora, Camera, Chapter, Words } from "../lib/fx";
import { easeInOut, expoOut, keys, prog, useT } from "../lib/time";

const FORECAST = TOOLS.forecast.rows.slice(0, 12);
const LABELS = [...HISTORY.labels, ...FORECAST.map((r) => r.label)];
const SERIES = [
  { name: "Cash at bank", kind: "actual" as const, values: [...HISTORY.cash, ...FORECAST.map(() => null)] },
  { name: "Base case", kind: "forecast" as const, values: [...HISTORY.cash.map((v, i) => (i === HISTORY.cash.length - 1 ? v : null)), ...FORECAST.map((r) => Math.round(r.cash))] },
];

/** The overview page as the app draws it, for the sample company, frozen so it isn't rebuilt every frame. */
const OverviewPage = memo(function OverviewPage() {
  return (
    <AppShell
      active="overview"
      title="Good morning, Aoife"
      subtitle="Kestrel Joinery Ltd · figures to 30 September 2026, synced from Xero at 07:02"
      breadcrumbs={["Overview"]}
      status={<StatusPill status="synced">Synced 07:02</StatusPill>}
      actions={
        <>
          <PeriodPicker label="Sep 2026" />
          <Button size="sm" icon="download">Export</Button>
        </>
      }
      syncText="Synced from Xero · 07:02"
      runway={24}
      sidebar={{ onAsk: () => {}, onSearch: () => {} }}
    >
      <div className="ov-grid">
        <div className="ov-top">
          <HeroMetric icon="bank" label="Cash at bank · 30 Sep 2026" value={228780} delta={-0.181} deltaLabel="vs 31 Aug" meta="Lowest point €187,469 in November, then it rebuilds">
            <LineChart labels={LABELS} series={SERIES as never} forecastFrom={12} todayLabel="Today" zero endLabels height={250} />
          </HeroMetric>
          <HeroChat />
        </div>
        <div className="ll-kpi-strip">
          <KpiTile icon="euro" label="Revenue, September" value={246281} delta={0.169} deltaLabel="vs Aug" spark={HISTORY.revenue} />
          <KpiTile icon="trend-up" label="Net profit, September" value={28471} delta={0.798} deltaLabel="vs Aug" spark={HISTORY.netProfit} />
          <KpiTile icon="percent" label="Gross margin" value={0.423} format="pct" note="Within its usual range" />
          <KpiTile icon="invoice" tone="warning" label="Debtor days" value={48} format="days" note="Up from 42 in June" />
        </div>
      </div>
    </AppShell>
  );
});

const LABELS_STRIP = ["Profit and loss", "Balance sheet", "Cash flow", "Forecast", "Scenarios", "Board pack"];

/** 30–39s: the morning view rises out of the dark; the camera drifts across what matters. */
export function Overview() {
  const t = useT();
  const rise = prog(t, 0.7, 2.6, expoOut);
  const rx = (1 - rise) * 38;
  const y = (1 - rise) * 520 + keys(t, [[2.6, 0], [8.8, -80]]);
  const scale = keys(t, [[0.7, 0.78], [2.6, 0.86], [5.2, 0.9], [8.8, 1.02]], easeInOut);
  const x = keys(t, [[2.6, 0], [5.2, 60], [8.8, -40]]);
  const ry = keys(t, [[2.6, 0], [5.2, -5], [8.8, 3]]);
  const head = 1 - prog(t, 1.6, 2.4);
  const out = prog(t, 8.5, 9);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out }}>
      <Aurora strength={0.8} hue="mixed" />
      <Chapter n="02" name="Every morning" at={0.1} />
      <div className="t-center ov-head" style={{ opacity: head, transform: `translateY(${-(1 - head) * 120}px)`, filter: `blur(${(1 - head) * 8}px)` }}>
        <div className="t-huge">
          <Words text="Every morning, *before coffee.*" at={0.1} stagger={0.08} />
        </div>
      </div>
      <Camera x={x} y={y} scale={scale} rx={rx} ry={ry} origin="50% 30%">
        <div className="film-window ov-window" style={{ opacity: prog(t, 0.7, 1.4) }}>
          <div className="film-window-bar">
            <i />
            <i />
            <i />
            <span>Overview · Kestrel Joinery Ltd</span>
          </div>
          <div className="ov-app">
            <OverviewPage />
          </div>
        </div>
      </Camera>
      <div className="ov-strip" style={{ opacity: prog(t, 4.6, 5.4) }}>
        {LABELS_STRIP.map((label, i) => (
          <span key={label} style={{ opacity: prog(t, 4.8 + i * 0.18, 5.3 + i * 0.18), transform: `translateY(${(1 - prog(t, 4.8 + i * 0.18, 5.5 + i * 0.18, expoOut)) * 20}px)` }}>
            {label}
          </span>
        ))}
        <em style={{ opacity: prog(t, 6.2, 6.8) }}>built from your journals, overnight</em>
      </div>
    </div>
  );
}
