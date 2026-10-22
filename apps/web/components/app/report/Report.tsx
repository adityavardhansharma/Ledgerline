"use client";

import { formatMoney, formatPct } from "@ledgerline/ui";
import type { ReactNode } from "react";

/**
 * The shared skeleton of the report pages: a line of headline figures, one sentence on what changed, then the
 * statement with a narrow rail beside it. Pages use the parts they need; boxes are kept for the statement itself.
 */

export type Figure = { label: string; value: string; change?: number | null; changeText?: string; good?: "up" | "down"; note?: string };

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** Money change as "+€12.4k"; percentages as "+3.2%". */
export const moneyChange = (euros: number) => `${sign(euros)}${formatMoney(Math.abs(euros), { compact: true })}`;
export const pctChange = (ratio: number) => `${sign(ratio)}${formatPct(Math.abs(ratio))}`;

export function SummaryLine({ figures }: { figures: Figure[] }) {
  return (
    <dl className="ll-summary">
      {figures.map((f) => {
        const tone = f.change == null || f.change === 0 || !f.good ? "" : (f.change > 0) === (f.good === "up") ? " is-good" : " is-bad";
        return (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
            {f.changeText || f.note ? (
              <dd className="ll-summary-foot">
                {f.changeText ? <span className={`ll-summary-change${tone}`}>{f.changeText}</span> : null}
                {f.note ? <span>{f.note}</span> : null}
              </dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

/** One plain sentence on what moved, worked out from the figures on the page. */
export function Takeaway({ children }: { children: ReactNode }) {
  return <p className="ll-takeaway">{children}</p>;
}

export function ReportGrid({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return (
    <div className="ll-report">
      <div className="ll-report-main">{main}</div>
      <aside className="ll-report-rail">{rail}</aside>
    </div>
  );
}

export function RailBlock({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="ll-rail-block">
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

type Part = { label: string; value: number };

/** What the business owns against what it owes: one slim bar each, the largest parts named. */
export function OwnOwe({ assets, claims }: { assets: Part[]; claims: Part[] }) {
  const max = Math.max(total(assets), total(claims), 1);
  return (
    <div className="ll-ownowe">
      <Side title="Owns" parts={assets} max={max} tone="own" />
      <Side title="Owes, and equity" parts={claims} max={max} tone="owe" />
    </div>
  );
}

function total(parts: Part[]) {
  return parts.reduce((n, p) => n + p.value, 0);
}

function Side({ title, parts, max, tone }: { title: string; parts: Part[]; max: number; tone: "own" | "owe" }) {
  const sorted = [...parts].sort((a, b) => b.value - a.value);
  const sum = total(parts);
  return (
    <div className={`ll-ownowe-side is-${tone}`}>
      <div className="ll-ownowe-head">
        <span>{title}</span>
        <b>{formatMoney(sum)}</b>
      </div>
      <div className="ll-ownowe-bar" style={{ width: `${(sum / max) * 100}%` }} role="img" aria-label={`${title}: ${sorted.map((p) => `${p.label} ${formatMoney(p.value)}`).join(", ")}`}>
        {sorted.map((p, i) => (
          <i key={p.label} style={{ flexGrow: p.value, opacity: 1 - Math.min(i, 4) * 0.17 }} title={`${p.label}: ${formatMoney(p.value)}`} />
        ))}
      </div>
      <ul>
        {sorted.slice(0, 3).map((p, i) => (
          <li key={p.label}>
            <i style={{ opacity: 1 - i * 0.17 }} />
            <span>{p.label}</span>
            <b>{formatMoney(p.value, { compact: true })}</b>
          </li>
        ))}
        {sorted.length > 3 ? (
          <li className="is-rest">
            <i style={{ opacity: 0.32 }} />
            <span>{sorted.length - 3} more</span>
            <b>{formatMoney(total(sorted.slice(3)), { compact: true })}</b>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
