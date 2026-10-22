"use client";

import { Button, HeroMetric, Icon, KpiTile, LedgerTable, LineChart, Logo, ReconcileCheck, RunwayGauge } from "@ledgerline/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { ActionCards, AskPill, BoardSample, ChatDemo } from "./AiShowcase";
import { DOORS_SEPTEMBER, HISTORY, TOOLS } from "./aiSamples";
import { WhatIf } from "./WhatIf";

const FORECAST = TOOLS.forecast.rows.slice(0, 12);
const CASH_LABELS = [...HISTORY.labels, ...FORECAST.map((r) => r.label)];
const CASH_SERIES = [
  { name: "Cash at bank", kind: "actual", values: [...HISTORY.cash, ...FORECAST.map(() => null)] },
  { name: "Base case", kind: "forecast", values: [...HISTORY.cash.map((v, i) => (i === HISTORY.cash.length - 1 ? v : null)), ...FORECAST.map((r) => Math.round(r.cash))] },
];

const PLANS: { name: string; price: string; per: string; for: string; featured?: boolean; soon?: boolean; items: [string, boolean?][] }[] = [
  {
    name: "Free",
    price: "€0",
    per: "forever",
    for: "For running Ledgerline on your own books.",
    items: [
      ["Up to 2 companies, from Xero or CSV"],
      ["All reports, forecasts, scenarios and board packs"],
      ["20 AI actions a month"],
      ["100 AI ledger searches a month"],
      ["50 AI chats a month", true],
      ["Unlimited team members"],
    ],
  },
  {
    name: "Pro",
    price: "€20",
    per: "a month",
    for: "For owners who run the business on it.",
    featured: true,
    soon: true,
    items: [["Everything in Free"], ["500 AI actions a month"], ["Unlimited AI ledger search"], ["500 AI chats a month", true]],
  },
  {
    name: "Max",
    price: "€100",
    per: "a month",
    for: "For finance leads who want the strongest analysis.",
    soon: true,
    items: [["Everything in Pro"], ["Stronger AI models for analysis"], ["1,000 AI actions a month"], ["Unlimited AI ledger search"], ["1,000 AI chats a month", true]],
  },
];

const FAQ = [
  ["Does Ledgerline change anything in Xero?", "No. It asks Xero for read-only access to journals, accounts, invoices and reports. It can't create invoices, post journals or move money."],
  ["How do I know the numbers are right?", "After every sync Ledgerline asks Xero for its own Profit and Loss and Balance Sheet and compares every account, month by month, to the cent. If anything differs you see exactly which account and why, and the figures are never hidden."],
  ["Does the AI make numbers up?", "No. In the chat, charts, tiles and tables are filled from your own figures, not typed by the model. In the board pack and AI actions, every figure is a citation of something Ledgerline computed, and the model isn't allowed to write a number at all."],
  ["What does the AI see?", "Only your organisation's figures, and only the parts it needs to answer: it asks Ledgerline for, say, the forecast or the cost breakdown, and works from that. Your questions and its answers are kept privately for you."],
  ["Where do the forecasts come from?", "From your actuals: growth, margin, overheads and payment terms are measured from your last few months. Branch the base case, change any driver, add hires, equipment, loans or equity, and every month still produces a balance sheet that balances."],
  ["What counts as an AI action?", "Each time you ask the AI to do something in place: explain a figure, draft the board-pack commentary, fill in a plan from a sentence, suggest a downside case. Asking about the same figures again is free until they change. Searches and chats are counted separately."],
  ["Can my accountant use it?", "Yes. Invite them as an Accountant: they can read every report and comment, but can't change scenarios or settings."],
  ["Can I try it without my own books?", "Yes. Load the sample company, a joinery with five years of books, or connect Xero's free Demo Company."],
] as const;

function Head({ n, kicker, title, children }: { n?: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="lp-head lp-reveal">
      <div>
        <div className="lp-kicker">
          {n ? <b>{n}</b> : null}
          {kicker}
        </div>
        <h2 className="lp-h2">{title}</h2>
      </div>
      {children ? <p className="lp-p">{children}</p> : null}
    </div>
  );
}

export function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="lp">
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-wrap lp-nav-inner">
          <Link href="/" aria-label="Ledgerline home">
            <Logo size={26} />
          </Link>
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#ask">Ask</a>
            <a href="#product">Product</a>
            <a href="#forecast">Forecasting</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-nav-cta">
            <ThemeToggle />
            <Link href="/sign-in" className="lp-signin">
              Sign in
            </Link>
            <Link href="/sign-up">
              <Button variant="primary">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-copy">
            <a href="#ask" className="lp-eyebrow">
              <b>New</b> Ask Ledgerline, an analyst that knows your books <Icon name="arrow-right" size={13} />
            </a>
            <h1 className="lp-h1">
              Your accounts, <em>explained</em> every morning.
            </h1>
            <p className="lp-lede">Ledgerline turns your Xero books into management accounts, a forecast and a board pack, checks every figure against Xero to the cent, and answers your questions about them in plain English.</p>
            <div className="lp-ctas">
              <Link href="/sign-up">
                <Button variant="primary" size="lg" iconRight="arrow-right">
                  Connect Xero, free
                </Button>
              </Link>
              <a href="#ask">
                <Button size="lg">Watch it answer</Button>
              </a>
            </div>
            <p className="lp-hero-note">Read-only access · Matches Xero to the cent · First report in about two minutes</p>
          </div>

          <div className="lp-wrap">
            <div className="lp-window" aria-label="Ledgerline's overview, for the sample company">
              <div className="lp-window-bar">
                <i />
                <i />
                <i />
                <span>Overview · Kestrel Joinery Ltd</span>
              </div>
              <div className="lp-window-body">
                <div className="lp-window-top">
                  <HeroMetric icon="bank" label="Cash at bank · 30 Sep 2026" value={228780} delta={-0.181} deltaLabel="vs 31 Aug" meta="Lowest point €187,469 in November, then it rebuilds">
                    <LineChart labels={CASH_LABELS} series={CASH_SERIES as never} forecastFrom={12} todayLabel="Today" zero endLabels height={230} />
                  </HeroMetric>
                  <div className="lp-window-gauge">
                    <RunwayGauge months={24} capped size={220} note="Positive through Sep 2028" />
                  </div>
                </div>
                <div className="ll-kpi-strip">
                  <KpiTile icon="euro" label="Revenue, September" value={246281} delta={0.169} deltaLabel="vs Aug" spark={HISTORY.revenue} />
                  <KpiTile icon="trend-up" label="Net profit, September" value={28471} delta={0.798} deltaLabel="vs Aug" spark={HISTORY.netProfit} />
                  <KpiTile icon="percent" label="Gross margin" value={0.423} format="pct" note="Within its usual range" />
                  <KpiTile icon="invoice" tone="warning" label="Debtor days" value={48} format="days" note="Up from 42 in June" />
                </div>
                <div className="lp-window-pill">
                  <AskPill />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-band" id="ask">
          <div className="lp-wrap">
            <Head n="01" kicker="Ask Ledgerline" title={<>Ask about your business. <em>Get the answer, and the chart.</em></>}>
              Press Ctrl J on any page. It reads the parts of your books it needs, says what it found and what it thinks, and draws the figures from your data, never from memory. These are its real answers about the sample company.
            </Head>
            <ChatDemo />
            <ul className="lp-notes">
              <li>
                <Icon name="reconcile" size={18} />
                <div>
                  <b>Figures from your books</b>
                  <span>Charts, tiles and tables are filled from your data, not typed by the model.</span>
                </div>
              </li>
              <li>
                <Icon name="sparkle" size={18} />
                <div>
                  <b>A view when you want one</b>
                  <span>Ask what it thinks and it says so, and what the figures can&apos;t tell you.</span>
                </div>
              </li>
              <li>
                <Icon name="lock" size={18} />
                <div>
                  <b>Private to you</b>
                  <span>Each person&apos;s conversations are their own, inside your organisation.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="product">
          <Head n="02" kicker="Numbers you can trust" title={<>Every figure goes back to a journal, <em>and matches Xero.</em></>}>
            Statements are built from your journals, not summaries. Click any figure to see the lines behind it, and after every sync each account is checked against Xero&apos;s own reports.
          </Head>
          <div className="lp-trust lp-reveal">
            <div className="lp-card">
              <div className="lp-card-cap">Profit and loss · September 2026</div>
              <table className="lp-statement">
                <tbody>
                  <tr>
                    <th>Sales: fitted kitchens</th>
                    <td>114,216</td>
                  </tr>
                  <tr className="is-picked">
                    <th>Sales: doors and joinery</th>
                    <td>132,064</td>
                  </tr>
                  <tr className="is-total">
                    <th>Revenue</th>
                    <td>246,281</td>
                  </tr>
                  <tr>
                    <th>Timber and materials</th>
                    <td>(117,916)</td>
                  </tr>
                  <tr>
                    <th>Subcontract fitters</th>
                    <td>(24,087)</td>
                  </tr>
                  <tr className="is-total is-double">
                    <th>Gross profit</th>
                    <td>104,278</td>
                  </tr>
                </tbody>
              </table>
              <div className="lp-drill">
                <div className="lp-card-cap">
                  <Icon name="ledger" size={14} /> Sales: doors and joinery · 3 journal lines
                </div>
                <LedgerTable hide={["account", "contact"]} lines={DOORS_SEPTEMBER} />
              </div>
            </div>
            <div className="lp-card">
              <div className="lp-card-cap">After every sync</div>
              <div className="lp-recons">
                <ReconcileCheck status="match" checkedAt="1 Oct 2026, 07:02" lines={13} />
                <ReconcileCheck status="match" report="balance sheet" checkedAt="1 Oct 2026, 07:02" lines={15} />
              </div>
              <ul className="lp-checks">
                <li>
                  <Icon name="check" size={16} /> Every account, every month, to the cent
                </li>
                <li>
                  <Icon name="check" size={16} /> Any difference named, with the account and the reason
                </li>
                <li>
                  <Icon name="check" size={16} /> Changes in Xero arrive within a minute
                </li>
                <li>
                  <Icon name="check" size={16} /> Negatives in brackets, double rules under totals
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="forecast">
          <Head n="03" kicker="Forecasting" title={<>Hire four fitters. <em>Watch the cash move.</em></>}>
            Move the drivers. This runs on the sample company&apos;s real base case; in the app every change runs a full three-statement forecast built from your own actuals.
          </Head>
          <div className="lp-reveal">
            <WhatIf />
          </div>
          <ul className="lp-notes">
            <li>
              <Icon name="branch" size={18} />
              <div>
                <b>Scenarios like branches</b>
                <span>Each stores only what it changes. Edit the base case and every branch inherits it.</span>
              </div>
            </li>
            <li>
              <Icon name="forecast" size={18} />
              <div>
                <b>Hires, equipment, loans, equity</b>
                <span>Added month by month, or typed as a sentence and filled in for you.</span>
              </div>
            </li>
            <li>
              <Icon name="balance" size={18} />
              <div>
                <b>Three statements that agree</b>
                <span>If the balance sheet ever fails to balance, the forecast refuses to run.</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="lp-section lp-wrap" id="actions">
          <Head n="04" kicker="AI actions" title={<>Small, sharp help, <em>where the question comes up.</em></>}>
            One click beside the figure you&apos;re looking at. Every number in an answer links back to where it came from, and nothing changes until you say so.
          </Head>
          <div className="lp-reveal">
            <ActionCards />
          </div>
          <p className="lp-also">Also in the app: a plan from a sentence, a downside case from your own history, payment reminders drafted for you, and fixes for an import that won&apos;t fit.</p>
        </section>

        <section className="lp-section lp-wrap" id="board">
          <div className="lp-split">
            <div className="lp-split-copy">
              <div className="lp-kicker">
                <b>05</b>Board pack
              </div>
              <h2 className="lp-h2">
                A board pack that <em>writes itself</em>, and cites every number.
              </h2>
              <p className="lp-p">Performance, cash, outlook, risks, decisions and the questions a board will ask, drafted from the figures Ledgerline has already worked out. Add what only you know, reword any section, and accept it before it goes anywhere.</p>
              <ul className="lp-checks">
                <li>
                  <Icon name="check" size={16} /> Written for a board, investors or a short note
                </li>
                <li>
                  <Icon name="check" size={16} /> Hover any figure to see where it came from
                </li>
                <li>
                  <Icon name="check" size={16} /> Versions kept; redraft one section at a time
                </li>
              </ul>
            </div>
            <div className="lp-reveal">
              <BoardSample />
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="security">
          <Head kicker="Security" title={<>Built like it&apos;s <em>holding your books.</em></>} />
          <div className="lp-security lp-reveal">
            <div>
              <Icon name="lock" size={20} />
              <h3>Read-only by design</h3>
              <p>Ledgerline can&apos;t write to Xero. Tokens are encrypted and never reach your browser.</p>
            </div>
            <div>
              <Icon name="organisation" size={20} />
              <h3>Isolated organisations</h3>
              <p>Every query is scoped to your organisation. Roles separate owners, editors and accountants.</p>
            </div>
            <div>
              <Icon name="audit" size={20} />
              <h3>Append-only audit log</h3>
              <p>Every sync, change and export is recorded, and nothing in the log can be edited.</p>
            </div>
            <div>
              <Icon name="reconcile" size={20} />
              <h3>Signed traffic</h3>
              <p>Xero webhooks are signature-checked, and internal services sign every request.</p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="pricing">
          <Head kicker="Pricing" title={<>Start free. <em>Upgrade for more AI.</em></>}>
            Every plan has every report, forecast, scenario and board pack, and connects Xero. Plans differ only in how much AI you use each month.
          </Head>
          <div className="lp-pricing lp-reveal">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`lp-plan${plan.featured ? " is-featured" : ""}`}>
                <div className="lp-plan-head">
                  <h3>{plan.name}</h3>
                  {plan.soon ? <span className="lp-tag">Coming soon</span> : null}
                </div>
                <div className="lp-price">
                  {plan.price} <small>{plan.per}</small>
                </div>
                <p className="lp-plan-for">{plan.for}</p>
                <ul>
                  {plan.items.map(([text, soon]) => (
                    <li key={text}>
                      <Icon name="check" size={16} />
                      <span>
                        {text}
                        {soon ? <em className="lp-soon">Soon</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {plan.soon ? (
                  <Button block disabled>
                    Coming soon
                  </Button>
                ) : (
                  <Link href="/sign-up">
                    <Button variant="primary" block>
                      Start free
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
          <p className="lp-fine">Paid plans open soon; everyone starts on Free. Prices in euro, billed monthly. Asking about the same figures again is free until they change.</p>
        </section>

        <section className="lp-section lp-wrap" id="faq">
          <div className="lp-faq-grid">
            <div className="lp-faq-side">
              <div className="lp-kicker">Questions</div>
              <h2 className="lp-h2">
                Answers, <em>in plain English.</em>
              </h2>
            </div>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap">
          <div className="lp-final">
            <h2 className="lp-h2">
              Know your cash <em>every morning.</em>
            </h2>
            <p className="lp-p">Connect Xero and see your first report in about two minutes.</p>
            <div className="lp-ctas">
              <Link href="/sign-up">
                <Button variant="primary" size="lg" iconRight="arrow-right">
                  Connect Xero, free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Logo size={22} />
        <span>© 2026 Ledgerline. Xero is a trademark of Xero Limited; Ledgerline is an independent product.</span>
        <nav aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
