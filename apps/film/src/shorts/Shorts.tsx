import { ReconcileCheck, SyncProgress } from "@ledgerline/ui";
import type { ComponentType } from "react";
import { Words } from "../lib/fx";
import { backOut, clamp, easeInOut, expoOut, keys, prog, Seq, spring, useT } from "../lib/time";
import { DraftBeat, ExplainBeat, FlagBeat, PlanBeat, SearchBeat } from "../scenes/Actions";
import { AskWindow } from "../scenes/Ask";
import { simulate, WhatIfCard } from "../scenes/Forecast";
import { Validator } from "../scenes/Trust";
import { Caption, Hook, Product, ShortFrame } from "./kit";

/**
 * Five vertical shorts for Reels and YouTube Shorts, 1080×1920, each one idea: a hook in the first two seconds, the
 * product doing it, the payoff, and the end card. Timings are seconds from the short's start; the score for each
 * (render/score.mjs --short <id>) hits the same marks.
 */

/** 1 · Ask: a question in plain English, answered with the chart, from the books. */
function AskShort() {
  return (
    <ShortFrame hue="forecast">
      <Hook text="Ask your books *anything.*" settle={1.6} />
      {/* The window's own clock types at 3 s; starting it 1 s early puts the typing at 2 s. */}
      <Seq at={-1} dur={30}>
        <div className="sh-ask">
          <Product at={2.2} top={360} zoom={1.0} width={1000}>
            <AskWindow />
          </Product>
        </div>
      </Seq>
      <Caption
        top={1600}
        lines={[
          [12.6, "Figures from your books. *Never from memory.*"],
        ]}
      />
    </ShortFrame>
  );
}

/** 2 · Cash runs out: hire four fitters, customers pay late, the cash goes red; collect faster and it's fixed. */
function CashShort() {
  const t = useT();
  const fitters = Math.round(keys(t, [[2.4, 0], [3.8, 4]], easeInOut));
  const debtorDays = Math.round(keys(t, [[4.6, 48], [6.4, 82], [8.4, 82], [9.9, 38]], easeInOut));
  const growth = Math.round(keys(t, [[8.4, 0], [9.9, 1.5]], easeInOut) * 2) / 2;
  const danger = simulate(fitters, debtorDays, growth).some((v) => v < 0);
  return (
    <ShortFrame hue={danger ? "negative" : "forecast"}>
      <div className="sh-red" style={{ opacity: danger ? 0.55 + Math.sin(t * 8) * 0.12 : 0 }} />
      <Hook text="What if I hire *four fitters?*" settle={2.0} />
      <div className="sh-cash">
        <Product at={1.4} top={560} zoom={1.0} width={1000}>
          <WhatIfCard fitters={fitters} debtorDays={debtorDays} growth={growth} />
        </Product>
      </div>
      <Caption
        top={1420}
        lines={[
          [2.6, "Four fitters from January."],
          [4.6, "Then customers *pay late.*"],
          [6.6, "Cash runs out."],
          [8.6, "Collect faster. *Fixed.*"],
          [10.6, "Every change runs a full *three-statement forecast.*"],
        ]}
      />
    </ShortFrame>
  );
}

/** 3 · To the cent: the sync runs, and every account is checked against Xero's own reports. */
function CentShort() {
  const t = useT();
  const phase = t < 3.2 ? 0 : t < 4.6 ? 1 : t < 5.0 ? 2 : t < 5.4 ? 3 : 4;
  const journals = Math.round(2412 * prog(t, 3.1, 4.6, (p) => p));
  const pages = Math.round(25 * prog(t, 2.4, 5.8, (p) => p));
  const sync = 1 - prog(t, 6.0, 6.4);
  const r1 = spring(t, 6.3, { stiffness: 160, damping: 14 });
  const r2 = spring(t, 6.7, { stiffness: 160, damping: 14 });
  return (
    <ShortFrame>
      <Hook text="Is your dashboard *actually right?*" settle={2.0} />
      {sync > 0 ? (
        <div className="fx-scene" style={{ opacity: sync }}>
          <Product at={1.8} top={720} zoom={1.65} width={580}>
            <div className="film-card sh-pad">
              <SyncProgress org="Kestrel Joinery Ltd" pagesDone={pages} pagesTotal={25} journals={journals} eta={pages < 25 ? `${Math.max(1, Math.round((25 - pages) * 3.5))} seconds` : undefined} phase={phase} />
            </div>
          </Product>
        </div>
      ) : null}
      {t > 6.1 ? (
        <div className="sh-recon">
          <div className="cn-recon-item film-glow-brand" style={{ opacity: clamp(r1 * 2), transform: `scale(${0.8 + r1 * 0.2}) translateY(${(1 - r1) * 30}px)` }}>
            <ReconcileCheck status="match" report="P&L" checkedAt="07:02" lines={13} />
          </div>
          <div className="cn-recon-item film-glow-brand" style={{ opacity: clamp(r2 * 2), transform: `scale(${0.8 + r2 * 0.2}) translateY(${(1 - r2) * 30}px)` }}>
            <ReconcileCheck status="match" report="Balance Sheet" checkedAt="07:02" lines={21} />
          </div>
          <div className="cn-stamp sh-stamp" style={{ opacity: prog(t, 7.2, 7.4), transform: `rotate(-8deg) scale(${1.6 - 0.6 * backOut(clamp((t - 7.2) / 0.35))})` }}>
            €0.00 difference
          </div>
        </div>
      ) : null}
      <Caption
        top={1460}
        lines={[
          [2.4, "Ledgerline reads your Xero books. *Read-only.*"],
          [7.8, "Then checks every account against Xero. *To the cent.*"],
        ]}
      />
    </ShortFrame>
  );
}

/** 4 · No made-up numbers: the board pack's rule, a figure without a source is struck out. */
function CiteShort() {
  const t = useT();
  return (
    <ShortFrame>
      <Hook text="Should AI write your *board pack?*" settle={2.0} />
      {/* The validator's own clock: paper at 0.6 s, scan from 1.4 s, the rejection at 3 s, sources at 4.3 s. */}
      <Seq at={1.6} dur={30}>
        <div className="sh-cite">
          <Validator />
        </div>
      </Seq>
      <div className="sh-only" style={{ opacity: prog(t, 6.8, 7.2) }}>
        <div className="sh-big">
          <Words text="Only if it can't *make up a number.*" at={6.8} stagger={0.07} />
        </div>
      </div>
      <Caption top={1500} lines={[[8.4, "Every figure is a citation of something *Ledgerline computed.*"]]} />
    </ShortFrame>
  );
}

const ACTIONS: Array<[string, ComponentType, number, string]> = [
  ["Search.", SearchBeat, 3.8, "The ledger, in your own words."],
  ["Explain.", ExplainBeat, 3.2, "Why any figure is what it is."],
  ["Flag.", FlagBeat, 2.2, "Unusual movements, spotted for you."],
  ["Plan.", PlanBeat, 3.6, "A plan from a sentence."],
  ["Draft.", DraftBeat, 2.8, "A board pack that cites every number."],
];

/** 5 · Five AI actions, one verb each. */
function ActionsShort() {
  let at = 2.0;
  return (
    <ShortFrame hue="forecast">
      <Hook text="5 things your accounts can now *do for you.*" settle={1.7} />
      {ACTIONS.map(([verb, Beat, dur, line], i) => {
        const start = at;
        at += dur;
        return (
          <Seq key={verb} at={start} dur={dur}>
            <ActionBeat verb={verb} line={line} n={i + 1} dur={dur}>
              <Beat />
            </ActionBeat>
          </Seq>
        );
      })}
    </ShortFrame>
  );
}

function ActionBeat({ verb, line, n, dur, children }: { verb: string; line: string; n: number; dur: number; children: React.ReactNode }) {
  const t = useT();
  const inn = prog(t, 0, 0.4, expoOut);
  const out = prog(t, dur - 0.25, dur, (p) => p * p);
  return (
    <div className="fx-scene" style={{ opacity: inn * (1 - out) }}>
      <div className="sh-verb" style={{ transform: `translateY(${(1 - inn) * 60 - out * 40}px)`, filter: `blur(${(1 - inn) * 12 + out * 12}px)` }}>
        <span className="t-mono">{n} / 5</span>
        <b>{verb}</b>
        <small>{line}</small>
      </div>
      <div className="sh-action" style={{ transform: `translateX(${(1 - inn) * 160 - out * 160}px)` }}>
        <div className="ac-card sh-action-card">{children}</div>
      </div>
    </div>
  );
}

export const SHORTS: Record<string, { length: number; Short: ComponentType }> = {
  ask: { length: 19, Short: AskShort },
  cash: { length: 17, Short: CashShort },
  cent: { length: 14.5, Short: CentShort },
  cite: { length: 15, Short: CiteShort },
  actions: { length: 21.2, Short: ActionsShort },
};
