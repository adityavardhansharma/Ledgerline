"use client";

import { Button, HeroMetric, Icon, KpiTile, LineChart, Logo } from "@ledgerline/ui";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { AskPill, ChatDemo, HeroChat } from "./AiShowcase";
import { HISTORY, TOOLS } from "./aiSamples";
import { ExplainScene, SearchScene, UnusualStill } from "./Scenes";
import { BoardWidget, TrustWidget } from "./Widgets";
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
    items: [["Everything in Free"], ["Up to 5 companies"], ["500 AI actions a month"], ["Unlimited AI ledger search"], ["500 AI chats a month", true]],
  },
  {
    name: "Max",
    price: "€50",
    per: "a month",
    for: "For finance leads who want the strongest analysis.",
    soon: true,
    items: [["Everything in Pro"], ["Up to 5 companies"], ["Stronger AI models for analysis"], ["1,000 AI actions a month"], ["Unlimited AI ledger search"], ["1,000 AI chats a month", true]],
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

function Intro({ kicker, title, children, small }: { kicker: string; title: React.ReactNode; children?: React.ReactNode; small?: boolean }) {
  return (
    <div className="lp-intro">
      <div className="lp-kicker">{kicker}</div>
      <h2 className={small ? "lp-h2 is-small" : "lp-h2"}>{title}</h2>
      {children ? <p className="lp-p">{children}</p> : null}
    </div>
  );
}

const SECTIONS = [
  ["ask", "Ask"],
  ["actions", "AI actions"],
  ["forecast", "Forecasting"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
] as const;

/**
 * The header: clear and full width over the hero, then, once the page moves, it draws in to a floating glass pill.
 * A soft highlight follows the pointer between links, and a dot marks the section you're reading.
 */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    const seen = new Map<string, boolean>();
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        setCurrent(SECTIONS.find(([id]) => seen.get(id))?.[0] ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", on);
      spy.disconnect();
    };
  }, []);
  return (
    <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="lp-nav-inner">
        <Link href="/" aria-label="Ledgerline home" className="lp-nav-logo">
          <Logo size={26} />
        </Link>
        <nav className="lp-nav-links" aria-label="Sections" onMouseLeave={() => setHover(null)}>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={current === id ? "is-current" : undefined} aria-current={current === id ? "true" : undefined} onMouseEnter={() => setHover(id)} onFocus={() => setHover(id)}>
              {hover === id ? <motion.span layoutId="lp-nav-hover" className="lp-nav-hover" transition={{ type: "spring", stiffness: 500, damping: 38 }} /> : null}
              <span className="lp-nav-label">{label}</span>
              {current === id ? <motion.i layoutId="lp-nav-dot" className="lp-nav-dot" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
            </a>
          ))}
        </nav>
        <div className="lp-nav-cta">
          <ThemeToggle />
          <Link href="/sign-in" className="lp-signin">
            Sign in
          </Link>
          <Link href="/sign-up" className="lp-nav-start">
            Start free
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Landing() {
  return (
    <div className="lp">
      <Header />

      <main>
        <section className="lp-hero lp-wrap">
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

          <div className="lp-stage">
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
                    <LineChart labels={CASH_LABELS} series={CASH_SERIES as never} forecastFrom={12} todayLabel="Today" zero endLabels height={220} />
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
            </div>
            <div className="lp-stage-pill">
              <AskPill />
            </div>
          </div>

          <ul className="lp-proof">
            <li>
              <Icon name="lock" size={15} /> Read-only Xero access
            </li>
            <li>
              <Icon name="reconcile" size={15} /> Matches Xero to the cent
            </li>
            <li>
              <Icon name="clock" size={15} /> First report in about two minutes
            </li>
          </ul>
        </section>

        <section className="lp-section lp-wrap" id="ask">
          <ChatDemo>
            <Intro kicker="Ask Ledgerline" title="Ask about your business. Get the answer and the chart.">
              Press Ctrl J on any page. It reads the parts of your books it needs and draws the figures from your data, never from memory. Real answers about the sample company:
            </Intro>
          </ChatDemo>
        </section>

        <section className="lp-small lp-wrap" id="actions">
          <div className="lp-row is-small">
            <Intro kicker="AI search" title="Search the ledger in your own words." small>
              Type what you&apos;re looking for. Ledgerline turns it into filters you can see and change, then finds the lines.
            </Intro>
            <div className="lp-widget">
              <SearchScene />
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="product">
          <div className="lp-row">
            <Intro kicker="Numbers you can trust" title="Every figure goes back to a journal, and matches Xero.">
              Statements are built from your journals, not summaries. Open any figure to see the lines behind it. After every sync, each account is checked against Xero&apos;s own reports.
            </Intro>
            <TrustWidget />
          </div>
        </section>

        <section className="lp-small lp-wrap">
          <div className="lp-row is-small is-flipped">
            <div className="lp-widget">
              <ExplainScene />
            </div>
            <Intro kicker="AI explain" title="Ask why any figure is what it is." small>
              Click a line of any statement for the reason in a sentence, with each figure traced to its journals.
            </Intro>
          </div>
        </section>

        <section className="lp-small lp-wrap">
          <div className="lp-strip">
            <div>
              <div className="lp-kicker">AI flags</div>
              <h3 className="lp-strip-title">Unusual movements, spotted for you.</h3>
            </div>
            <UnusualStill />
          </div>
          <p className="lp-also">Also in the app: a plan from a sentence, a downside case from your own history, payment reminders drafted for you, and fixes for an import that won&apos;t fit.</p>
        </section>

        <section className="lp-section lp-wrap" id="forecast">
          <div className="lp-row is-wide-right">
            <Intro kicker="Forecasting" title="Hire four fitters. Watch the cash move.">
              Drag the drivers. This runs on the sample company&apos;s real base case; in the app, every change runs a full three-statement forecast from your own actuals.
            </Intro>
            <WhatIf />
          </div>
        </section>

        <section className="lp-section lp-wrap" id="board">
          <div className="lp-row is-flipped">
            <BoardWidget />
            <Intro kicker="Board pack" title="A board pack that writes itself, and cites every number.">
              Performance, cash, outlook, risks, decisions and the questions a board will ask, drafted from figures Ledgerline has already worked out. Hover any number for its source; reword any section; accept it before it goes anywhere.
            </Intro>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="security">
          <div className="lp-security">
            <h2 className="lp-h3">Built like it&apos;s holding your books.</h2>
            <div>
              <Icon name="lock" size={18} />
              <h3>Read-only by design</h3>
              <p>It can&apos;t write to Xero. Tokens are encrypted and never reach your browser.</p>
            </div>
            <div>
              <Icon name="organisation" size={18} />
              <h3>Isolated organisations</h3>
              <p>Every query is scoped to your organisation, with roles for owners, editors and accountants.</p>
            </div>
            <div>
              <Icon name="audit" size={18} />
              <h3>Append-only audit log</h3>
              <p>Every sync, change and export is recorded, and nothing in it can be edited.</p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="pricing">
          <Intro kicker="Pricing" title="Start free. Upgrade for more AI.">
            Every plan has every report, forecast, scenario and board pack. Plans differ only in how much AI you use each month.
          </Intro>
          <div className="lp-pricing">
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
                      <Icon name="check" size={15} />
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
          <div className="lp-row is-faq">
            <Intro kicker="Questions" title="Answers, in plain English." />
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
            <h2 className="lp-h1 is-final">
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
          <a href="#actions">AI actions</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
