"use client";

import {
  Button,
  CommentaryCard,
  DonutChart,
  HeroMetric,
  Icon,
  KpiTile,
  LedgerTable,
  LineChart,
  Logo,
  ReconcileCheck,
  RunwayGauge,
  SankeyChart,
  ScenarioCard,
  TornadoChart,
  WaterfallChart,
  demo,
} from "@ledgerline/ui";
import Link from "next/link";
import { ThemeToggle } from "../ThemeToggle";
import { WhatIf } from "./WhatIf";

const D = demo as Record<string, any>;

const FAN = [
  { name: "Likely range", kind: "band", lower: D.fan.outer.lower, upper: D.fan.outer.upper, opacity: 0.6 },
  { name: "Probable range", kind: "band", lower: D.fan.inner.lower, upper: D.fan.inner.upper },
  { name: "Cash at bank", kind: "actual", values: D.cashChart.actual },
  { name: "Base case", kind: "forecast", values: D.cashChart.base },
];

const PLANS: { name: string; price: string; per: string; for: string; featured?: boolean; soon?: boolean; cta: string; items: [string, boolean?][] }[] = [
  {
    name: "Free",
    price: "€0",
    per: "forever",
    for: "For trying Ledgerline on your own books.",
    cta: "Start free",
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
    cta: "Start free, upgrade any time",
    items: [
      ["Everything in Free"],
      ["500 AI actions a month"],
      ["Unlimited AI ledger search"],
      ["500 AI chats a month", true],
    ],
  },
  {
    name: "Max",
    price: "€100",
    per: "a month",
    for: "For finance leads who want the strongest analysis.",
    soon: true,
    cta: "Start free, upgrade any time",
    items: [
      ["Everything in Pro"],
      ["Stronger AI models for analysis"],
      ["1,000 AI actions a month"],
      ["Unlimited AI ledger search"],
      ["1,000 AI chats a month", true],
    ],
  },
];

const FAQ = [
  ["Does Ledgerline change anything in Xero?", "No. It asks Xero for read-only access to journals, accounts, invoices and reports. It can't create invoices, post journals or move money."],
  ["How do I know the numbers are right?", "After every sync Ledgerline asks Xero for its own Profit and Loss and Balance Sheet and compares every account, month by month, to the cent. If anything differs you see exactly which account and why, and the figures are never hidden."],
  ["Where do the forecasts come from?", "From your actuals: growth, margin, overheads and payment terms are measured from your last few months. You can branch the base case and change any driver, add hires, equipment, loans or equity, and every month still produces a balance sheet that balances."],
  ["What does the AI do?", "Only one thing: it drafts the commentary in your board pack from figures Ledgerline has already calculated. Every number in the draft is a citation you can click. If the model writes a number of its own, the draft is rejected. A person accepts it before it can be exported."],
  ["Can my accountant use it?", "Yes. Invite them as an Accountant: they can read every report and comment, but can't change scenarios or settings."],
  ["What counts as an AI action?", "Each time you ask the AI to do something: explain a figure, draft or redraft the board-pack commentary or one of its sections, fill in a plan from a sentence, suggest a downside case, explain a difference from Xero, and so on. Asking about the same figures again is free until they change. Ledger searches and chats are counted separately."],
  ["Can I try it without my own books?", "Yes. Connect Xero's free Demo Company. It resets every 28 days; Ledgerline notices and resyncs on its own."],
] as const;

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link href="/" aria-label="Ledgerline home"><Logo size={26} /></Link>
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#product">Product</a>
            <a href="#forecast">Forecasting</a>
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-nav-cta">
            <ThemeToggle />
            <Link href="/sign-in"><Button variant="ghost">Sign in</Button></Link>
            <Link href="/sign-up"><Button variant="primary">Start free</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero lp-wrap">
          <span className="lp-eyebrow"><b>New</b> Three-statement forecasts with branchable scenarios</span>
          <h1 className="lp-h1">Your management accounts, <em>every morning</em>.</h1>
          <p className="lp-lede">
            Ledgerline reads your Xero ledger, builds your profit and loss, balance sheet and cash flow, checks every account against Xero to the cent, and tells you how many months of cash you have left.
          </p>
          <div className="lp-ctas">
            <Link href="/sign-up"><Button variant="primary" size="lg" iconRight="arrow-right">Connect Xero, free</Button></Link>
            <a href="#forecast"><Button size="lg" icon="forecast">Try the forecast</Button></a>
          </div>
          <div className="lp-trust">
            <span><Icon name="lock" size={15} /> Read-only Xero access</span>
            <span><Icon name="reconcile" size={15} /> Matches Xero to the cent</span>
            <span><Icon name="clock" size={15} /> First sync in about 2 minutes</span>
          </div>

          <div className="lp-window" aria-label="Ledgerline overview, with a sample company">
            <div className="lp-window-bar"><i /><i /><i /><span>ledgerline · Overview · Kestrel Joinery Ltd (sample)</span></div>
            <div className="lp-window-body">
              <div className="ll-grid-2 ll-stretch">
                <HeroMetric icon="bank" label="Cash at bank · 30 Sep 2026" value={412300} delta={-0.066} deltaLabel="vs 31 Aug" meta="On the base case, cash runs out in December 2027">
                  <LineChart labels={D.cashChart.labels} series={FAN as never} forecastFrom={9} todayLabel="Today" zero endLabels height={240} thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]} />
                </HeroMetric>
                <div className="ll-panel" style={{ padding: 20, display: "grid", placeItems: "center" }}>
                  <RunwayGauge months={14.0} cashOut="Dec 2027" size={240} />
                </div>
              </div>
              <div className="ll-kpi-strip">
                <KpiTile icon="euro" label="Revenue, September" value={D.kpis.revenue} delta={0.158} deltaLabel="vs Aug" spark={D.revenue.slice(0, 9)} />
                <KpiTile icon="trend-up" label="Net profit, September" value={21087} delta={0.898} deltaLabel="vs Aug" spark={D.netProfit.slice(0, 9)} />
                <KpiTile icon="percent" label="Gross margin" value={0.42} format="pct" note="Steady all year" />
                <KpiTile icon="invoice" tone="warning" label="Debtor days" value={41} format="days" delta={0.14} invert deltaLabel="vs Q2" />
              </div>
            </div>
          </div>
        </section>

        <div className="lp-wrap">
          <div className="lp-stats">
            <div className="lp-stat"><b>€0.00</b><span>Difference from Xero's own reports, checked after every sync</span></div>
            <div className="lp-stat"><b>3</b><span>Linked statements per forecast month, and every one balances</span></div>
            <div className="lp-stat"><b>&lt;2 min</b><span>From connecting Xero to seeing your first report</span></div>
            <div className="lp-stat"><b>0</b><span>Numbers written by AI. It only explains the ones we compute</span></div>
          </div>
        </div>

        <section className="lp-section lp-wrap" id="product">
          <div className="lp-split">
            <div>
              <div className="lp-kicker">Where the money went</div>
              <h2 className="lp-h2">Every euro of revenue, <em>followed to the bottom line</em>.</h2>
              <p className="lp-p">See September's €228,900 of sales flow through cost of sales and every overhead to €21,087 of net profit. Hover any flow to isolate it. It's the profit and loss, drawn.</p>
              <ul className="lp-points">
                <li><Icon name="check" size={18} /><span><b>Built from journals,</b> not summaries, so every figure traces back to a line in Xero.</span></li>
                <li><Icon name="check" size={18} /><span><b>Statements you already know:</b> P&amp;L, balance sheet and cash flow, by month, with your account codes.</span></li>
                <li><Icon name="check" size={18} /><span><b>Accounting conventions throughout:</b> negatives in parentheses, double rules under totals.</span></li>
              </ul>
            </div>
            <div className="lp-sheet"><SankeyChart nodes={D.sankey.nodes} links={D.sankey.links} height={380} /></div>
          </div>
        </section>

        <section className="lp-section lp-wrap">
          <div className="lp-kicker">Trust the numbers</div>
          <h2 className="lp-h2">Click any figure. <em>See the journals behind it.</em></h2>
          <div className="lp-bento">
            <div className="lp-cell lp-c-4">
              <h3>Drill down to the ledger</h3>
              <p>Every actual figure in a statement opens the journal lines that make it up. Debits equal credits; the net equals the cell.</p>
              <LedgerTable hide={["account", "contact"]} lines={D.ledgerLines.slice(0, 5)} />
            </div>
            <div className="lp-cell lp-c-2 no-r">
              <h3>Reconciled with Xero</h3>
              <p>After each sync, every account is compared with Xero's own reports. Differences are named, never hidden.</p>
              <ReconcileCheck status="match" checkedAt="20 Oct 2026, 09:14" lines={42} />
              <ReconcileCheck status="mismatch" report="balance sheet" diff={1240.5} detail="2201 VAT: a journal posted after the last sync." />
            </div>
            <div className="lp-cell lp-c-4 no-b">
              <h3>Why profit isn't cash</h3>
              <p>The cash bridge shows how a profitable month still lost €29,000: customers paying slower.</p>
              <WaterfallChart steps={D.bridge} height={260} />
            </div>
            <div className="lp-cell lp-c-2 no-r no-b">
              <h3>Who owes you</h3>
              <p>Debtors by age from your open invoices, so you know who to chase first.</p>
              <DonutChart size={170} thickness={16} centerLabel="Owed to you" items={D.agedDebtors.map((b: { label: string; value: number }, i: number) => ({ label: b.label, value: b.value, swatch: [1, 4, 3, 5, 5][i] }))} />
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="forecast">
          <div className="lp-kicker">Plan the what-ifs</div>
          <h2 className="lp-h2">Hire two people. <em>Watch the runway move.</em></h2>
          <p className="lp-p">Drag the drivers. This is a simplified version of the forecast running on a sample joinery; in the app it's a full three-statement model built from your own actuals.</p>
          <WhatIf />
        </section>

        <section className="lp-section lp-wrap">
          <div className="lp-split">
            <div className="ll-stack">
              <div className="ll-grid-halves" style={{ gap: 12 }}>
                <ScenarioCard {...D.scenarios[0]} cash={D.scenarios[0].cash} active horizon={24} cashLabel="Cash Sep 2027" />
                <ScenarioCard {...D.scenarios[1]} compare horizon={24} cashLabel="Cash Sep 2027" />
              </div>
              <div className="lp-sheet"><TornadoChart base={D.tornado.base} rows={D.tornado.rows.slice(0, 4)} /></div>
            </div>
            <div>
              <div className="lp-kicker">Scenarios like branches</div>
              <h2 className="lp-h2">Branch the base case. <em>Compare anything.</em></h2>
              <p className="lp-p">Scenarios store only what they change, like branches in Git. Edit the base and every branch inherits it. Ledgerline shows which assumption moves your runway most, so you spend your attention on the right one.</p>
              <ul className="lp-points">
                <li><Icon name="branch" size={18} /><span><b>Hires, equipment, loans and equity</b> as plan items, month by month.</span></li>
                <li><Icon name="forecast" size={18} /><span><b>Uncertainty shown, not hidden:</b> every forecast carries its likely range.</span></li>
                <li><Icon name="balance" size={18} /><span><b>Three statements that agree:</b> if the balance sheet ever fails to balance, the forecast refuses to run.</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap">
          <div className="lp-split">
            <div>
              <div className="lp-kicker">Board pack</div>
              <h2 className="lp-h2">Commentary that <em>cites every number</em>.</h2>
              <p className="lp-p">Ledgerline drafts the month's commentary in plain English. Each figure is a link to where it came from, and the model is never allowed to write a number itself. You accept it, then export the pack as a PDF.</p>
            </div>
            <CommentaryCard paragraphs={[
              ["Revenue reached ", { text: "€228,900", source: "4000 Sales, Sep 2026" }, ", the strongest month this year, with gross margin steady at ", { text: "42.0%", source: "Gross profit ÷ revenue" }, "."],
              ["Cash fell ", { text: "€29,000", source: "Cash bridge, Sep 2026" }, " despite a profit of ", { text: "€21,087", source: "Net profit, Sep 2026" }, ", because customers now owe ", { text: "€38,400", source: "Trade debtors movement" }, " more."],
            ]} />
          </div>
        </section>

        <section className="lp-section lp-wrap" id="how">
          <div className="lp-kicker">How it works</div>
          <h2 className="lp-h2">From Xero to a forecast <em>before your coffee cools</em>.</h2>
          <div className="lp-steps">
            <div className="lp-step"><div className="lp-step-n">01</div><h3>Connect Xero</h3><p>Pick your organisation on Xero's own screen. Ledgerline asks for read-only access and nothing else.</p></div>
            <div className="lp-step"><div className="lp-step-n">02</div><h3>We sync and check</h3><p>Journals, accounts and invoices sync in minutes, then every account is reconciled with Xero. Changes in Xero arrive within a minute.</p></div>
            <div className="lp-step"><div className="lp-step-n">03</div><h3>Read, plan, share</h3><p>Open your overview each morning, branch scenarios when a decision comes up, and send the board pack at month end.</p></div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="security">
          <div className="lp-kicker">Security</div>
          <h2 className="lp-h2">Built like it's <em>holding your books</em>.</h2>
          <div className="lp-security">
            <div className="lp-sec"><Icon name="lock" size={22} /><h3>Read-only by design</h3><p>Ledgerline can't write to Xero. Tokens are encrypted with AES-GCM and never reach your browser.</p></div>
            <div className="lp-sec"><Icon name="organisation" size={22} /><h3>Isolated organisations</h3><p>Every query is scoped to your organisation. Roles separate owners, editors and accountants.</p></div>
            <div className="lp-sec"><Icon name="audit" size={22} /><h3>Append-only audit log</h3><p>Every sync, change and export is recorded. Nothing in the log can be edited or deleted.</p></div>
            <div className="lp-sec"><Icon name="reconcile" size={22} /><h3>Signed, verified traffic</h3><p>Xero webhooks are signature-checked, and internal services sign every request.</p></div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="pricing">
          <div className="lp-kicker">Pricing</div>
          <h2 className="lp-h2">Start free. <em>Upgrade for more AI.</em></h2>
          <p className="lp-p lp-pricing-lede">Every plan has every report, forecast, scenario and board pack, and connects Xero. Plans differ in how much AI you use each month.</p>
          <div className="lp-pricing">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`lp-plan${plan.featured ? " is-featured" : ""}`}>
                <div className="lp-plan-head">
                  <h3>{plan.name}</h3>
                  {plan.soon ? <span className="lp-plan-tag is-soon">Coming soon</span> : plan.featured ? <span className="lp-plan-tag">Most popular</span> : null}
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
                        {soon ? <em className="lp-soon">Coming soon</em> : null}
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
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
          <p className="lp-pricing-note">Paid plans open soon; everyone starts on Free. Prices in euro, billed monthly. Unused AI doesn't roll over. Asking about the same figures again is free until they change.</p>
        </section>

        <section className="lp-section lp-wrap" id="faq">
          <div className="lp-kicker">Questions</div>
          <h2 className="lp-h2">Answers, <em>in plain English</em>.</h2>
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="lp-wrap">
          <section className="lp-final">
            <h2 className="lp-h2" style={{ margin: "0 auto" }}>Know your cash <em>every morning</em>.</h2>
            <p className="lp-p" style={{ margin: "18px auto 0" }}>Connect Xero and see your first report in about two minutes.</p>
            <div className="lp-ctas">
              <Link href="/sign-up"><Button variant="primary" size="lg" iconRight="arrow-right">Connect Xero, free</Button></Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="lp-wrap lp-footer">
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
