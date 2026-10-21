"use client";

import { Amount, Icon, LineChart, Logo, demo } from "@ledgerline/ui";

const D = demo as {
  company: string;
  asAt: string;
  kpis: { cash: number; runway: number };
  cashChart: { labels: string[]; actual: (number | null)[]; base: (number | null)[] };
  ledgerLines: { date: string; journal: string; code: string; account: string; contact: string; description: string; debit: number; credit: number }[];
};

// September 2026 for the sample company; ties to the design system's Sankey and statements.
const PNL: { label: string; value: number; kind?: "subtotal" | "total" }[] = [
  { label: "Revenue", value: 228900 },
  { label: "Cost of sales", value: -132800 },
  { label: "Gross profit", value: 96100, kind: "subtotal" },
  { label: "Operating costs", value: -68300 },
  { label: "Depreciation, interest and tax", value: -6713 },
  { label: "Net profit", value: 21087, kind: "total" },
];

const COPY = {
  signIn: {
    eyebrow: "Management accounts",
    title: (
      <>
        Every figure, <em>to the cent</em>, back to the journal line behind it.
      </>
    ),
    facts: [
      ["lock", "Read-only access to Xero"],
      ["check", "Every journal balanced"],
      ["audit", "An audit log nobody can edit"],
    ],
  },
  signUp: {
    eyebrow: "Start in two minutes",
    title: (
      <>
        Your ledger, turned into <em>three statements</em> and a forecast.
      </>
    ),
    facts: [
      ["plug", "Connect Xero"],
      ["upload", "Or import a CSV"],
      ["database", "Or try the sample company"],
    ],
  },
} as const;

/** The left half of the sign-in and sign-up pages: a page of the ledger, drawn with the real components. */
export function AuthArt({ variant }: { variant: "signIn" | "signUp" }) {
  const copy = COPY[variant];
  const lines = D.ledgerLines.slice(0, 3);
  return (
    <aside className="ll-auth-art" aria-label="What Ledgerline does">
      <div className="ll-auth-art-top">
        <Logo size={28} />
        <span className="ll-auth-sample">
          {D.company} · sample company
        </span>
      </div>

      <div className="ll-auth-pitch">
        <span className="ll-auth-eyebrow">{copy.eyebrow}</span>
        <h2>{copy.title}</h2>
      </div>

      <div className="ll-auth-sheet" aria-hidden="true">
        <div className="ll-auth-cash">
          <div>
            <span className="ll-auth-k">Cash at bank, {D.asAt}</span>
            <span className="ll-auth-hero">
              <Amount value={D.kpis.cash} />
            </span>
          </div>
          <div className="ll-auth-runway">
            <span className="ll-auth-k">Runway</span>
            <strong>{D.kpis.runway} months</strong>
          </div>
        </div>
        <div className="ll-auth-chart">
          <LineChart
            labels={D.cashChart.labels.slice(0, 15)}
            series={[
              { name: "Cash", kind: "actual", values: D.cashChart.actual.slice(0, 15) },
              { name: "Base case", kind: "forecast", values: D.cashChart.base.slice(0, 15) },
            ]}
            forecastFrom={8}
            todayLabel="Today"
            height={150}
            label="Cash at bank, actual and forecast"
          />
        </div>
        <div className="ll-auth-split">
          <table className="ll-auth-pnl">
            <caption>Profit and loss, Sep 2026</caption>
            <tbody>
              {PNL.map((r) => (
                <tr key={r.label} className={r.kind ? `is-${r.kind}` : undefined}>
                  <th scope="row">{r.label}</th>
                  <td>
                    <Amount value={r.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ll-auth-journal">
            <span className="ll-auth-caption">Behind revenue</span>
            {lines.map((l) => (
              <div key={l.journal} className="ll-auth-line">
                <span className="ll-auth-line-meta">
                  {l.date.slice(0, 6)} · {l.journal}
                </span>
                <span className="ll-auth-line-desc">{l.contact}</span>
                <span className="ll-auth-line-amt">
                  {l.credit ? <Amount value={l.credit} decimals={2} /> : <Amount value={-l.debit} decimals={2} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ul className="ll-auth-facts">
        {copy.facts.map(([icon, text]) => (
          <li key={text}>
            <Icon name={icon} size={16} />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
