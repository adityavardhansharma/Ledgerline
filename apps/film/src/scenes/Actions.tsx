import { AiOrb, Button, Icon } from "@ledgerline/ui";
import type { ReactNode } from "react";
import { AiButton, AiNote, AiProse, Thinking } from "../../../web/components/app/ai/AiAction";
import { SEARCH } from "../../../web/components/landing/aiSamples";
import { UnusualStill } from "../../../web/components/landing/Scenes";
import { BoardWidget } from "../../../web/components/landing/Widgets";
import { Aurora, Chapter, Cursor, Typed, useAnchors } from "../lib/fx";
import { clamp, expoOut, prog, Seq, useLength, useT } from "../lib/time";

const c = (text: string, source: string) => ({ text, source, fact: source });

/** One beat of the montage: a big verb on the left, the product doing it on the right. */
function Beat({ verb, line, children, n }: { verb: string; line: string; children: ReactNode; n: number }) {
  const t = useT();
  const len = useLength();
  const inn = prog(t, 0, 0.55, expoOut);
  const out = prog(t, len - 0.35, len, (p) => p * p);
  const dir = n % 2 ? -1 : 1;
  return (
    <div className="fx-scene">
      <div className="ac-verb" style={{ opacity: inn * (1 - out), transform: `translateY(${(1 - inn) * 80 - out * 60}px)`, filter: `blur(${(1 - inn) * 16 + out * 16}px)` }}>
        <div className="ac-count t-mono">
          <AiOrb size={16} busy /> AI action {n} / 5
        </div>
        <div className="t-mega">{verb}</div>
        <p className="t-small ac-line">{line}</p>
      </div>
      <div className="ac-card-pos" style={{ opacity: inn * (1 - out), transform: `translateX(${(1 - inn) * 160 * dir - out * 160 * dir}px) rotateY(${(1 - inn) * -18 * dir + out * 18 * dir}deg)`, filter: out ? `blur(${out * 14}px)` : undefined }}>
        <div className="ac-card">{children}</div>
      </div>
    </div>
  );
}

const CHIPS = ["Liffey Timber Supplies", "Apr – Jun 2026", "Over €5,000"];
const ROWS = SEARCH.rows.slice(0, 5);
const RECENT = [
  { date: "2026-09-28", account: "Sales: doors and joinery", debitCents: 0, creditCents: 4814548 },
  { date: "2026-09-26", account: "Wages and salaries", debitCents: 4806500, creditCents: 0 },
  { date: "2026-09-15", account: "Sales: doors and joinery", debitCents: 0, creditCents: 3461982 },
  { date: "2026-09-01", account: "Rent and rates", debitCents: 620000, creditCents: 0 },
  { date: "2026-08-29", account: "Timber and materials", debitCents: 1830411, creditCents: 0 },
];

function SearchBeat() {
  const t = useT();
  const typeAt = 0.55;
  const typedEnd = typeAt + SEARCH.query.length / 30;
  const reading = t >= typedEnd + 0.15 && t < typedEnd + 0.85;
  const chips = t < typedEnd + 0.85 ? 0 : Math.min(CHIPS.length, Math.floor((t - typedEnd - 0.85) / 0.14) + 1);
  const rows = chips < CHIPS.length ? 0 : Math.min(ROWS.length, Math.floor((t - typedEnd - 1.3) / 0.1) + 1);
  const filtered = chips > 0;
  return (
    <div className="lp-scene lp-scene-search ac-search">
      <div className={`lp-search${t >= typeAt - 0.2 && t < typedEnd + 0.15 ? " is-focus" : ""}`}>
        <Icon name="search" size={16} />
        <span className={t >= typeAt ? undefined : "is-placeholder"}>{t >= typeAt ? <Typed text={SEARCH.query} at={typeAt} cps={30} caret={t < typedEnd + 0.15} /> : "Search the ledger in your own words"}</span>
        {reading ? (
          <span className="lp-search-reading">
            <AiOrb size={13} busy />
            <span className="ll-shimmer">Reading your search</span>
          </span>
        ) : (
          <kbd>↵</kbd>
        )}
      </div>
      <div className="lp-search-chips">
        {CHIPS.slice(0, chips).map((chip, i) => {
          const p = prog(t, typedEnd + 0.85 + i * 0.14, typedEnd + 1.1 + i * 0.14, expoOut);
          return (
            <span key={chip} style={{ opacity: p, transform: `scale(${0.9 + p * 0.1}) translateY(${(1 - p) * 4}px)` }}>
              {chip}
            </span>
          );
        })}
        {rows === ROWS.length ? <em style={{ opacity: prog(t, typedEnd + 1.8, typedEnd + 2.1) }}>{SEARCH.count} lines</em> : null}
      </div>
      <table className="lp-mini-ledger">
        <tbody>
          {(filtered ? ROWS : RECENT).map((r, i) => {
            const p = filtered ? prog(t, typedEnd + 1.3 + i * 0.1, typedEnd + 1.6 + i * 0.1, expoOut) : 1;
            return (
              <tr key={`${filtered}-${i}`} style={{ opacity: filtered ? p : reading ? 0.35 : 1, transform: `translateY(${(1 - p) * 6}px)` }}>
                <td>{new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IE", { day: "numeric", month: "short", timeZone: "UTC" })}</td>
                <td>{r.account}</td>
                <td>{((r.debitCents || r.creditCents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PNL = [
  ["Sales: fitted kitchens", "114,216"],
  ["Sales: doors and joinery", "132,064"],
  ["Timber and materials", "(117,916)"],
  ["Wages and salaries", "(48,065)"],
] as const;

function ExplainBeat() {
  const t = useT();
  const a = useAnchors();
  const hover = t > 0.7;
  const click = 1.15;
  const busy = t > click && t < click + 1.0;
  return (
    <div className="lp-scene lp-scene-explain ac-explain">
      <table className="lp-mini-pnl">
        <tbody>
          {PNL.map(([label, value], i) => (
            <tr key={label} className={i === 1 && hover ? "is-hot" : undefined}>
              <th>{label}</th>
              <td>
                {i === 1 ? (
                  <span ref={a.ref("explain")} className={`lp-explain-btn${hover ? " is-shown" : ""}`} style={{ transform: `scale(${t > click && t < click + 0.15 ? 0.94 : 1})` }}>
                    <AiOrb size={12} busy={busy} /> Explain
                  </span>
                ) : null}
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {t > click ? (
        <AiNote title="Sales: doors and joinery, Sep 2026" busy={busy} steps={["Reading 3 journal lines"]}>
          <AiProse paragraphs={[["Up ", c("171.1%", "Statement, previous month"), " on August. Two jobs for the Ó Briain residence made up ", c("€97,444", "Journal lines"), " of it, invoiced on 25 and 28 September."]]} />
        </AiNote>
      ) : null}
      <Cursor path={[[0.2, 1500, 1000], [0.75, a.at("explain")[0] - 120, a.at("explain")[1]], [1.05, ...a.at("explain")], [1.6, ...a.at("explain")]]} clicks={[click]} hideAt={1.5} />
    </div>
  );
}

function FlagBeat() {
  const t = useT();
  const pulse = (t * 1.2) % 1;
  return (
    <div className="ac-flag">
      <div className="ac-flag-ring" style={{ transform: `scale(${1 + pulse * 0.08})`, opacity: (1 - pulse) * 0.7 }} />
      <UnusualStill />
    </div>
  );
}

const PLAN_TEXT = "Hire two fitters in March at 42k each, buy a van in June for 38k";
const PLAN_ROWS: Array<[string, string]> = [
  ["Hire 2 × Fitter from March 2027", "€42,000 a year each"],
  ["Equipment: Van, June 2027", "€38,000"],
];

function PlanBeat() {
  const t = useT();
  const typeAt = 0.4;
  const typed = typeAt + PLAN_TEXT.length / 48;
  const click = typed + 0.25;
  const busy = t > click && t < click + 1.0;
  const result = t >= click + 1.0;
  return (
    <div className="ll-composer ac-plan">
      <div className="ll-composer-box">
        <div className="ll-composer-input ac-plan-input">{t >= typeAt ? <Typed text={PLAN_TEXT} at={typeAt} cps={48} caret={t < click} /> : <span className="ac-ph">Describe a change in your own words</span>}</div>
        <div className="ll-composer-foot">
          <span className="ll-ai-muted">Describe changes in your own words; you&apos;ll check them before anything is saved.</span>
          <AiButton size="sm" busy={busy} onClick={() => {}}>
            Fill in the plan
          </AiButton>
        </div>
      </div>
      {busy ? <Thinking steps={["Reading what you wrote", "Matching it to your plan", "Filling in the details"]} /> : null}
      {result ? (
        <div className="ll-composer-result ll-chat-in">
          <ul>
            {PLAN_ROWS.map(([text, value], i) => (
              <li key={text} className="ll-reveal" style={{ animationDelay: `${i * 70}ms` }}>
                <label>
                  <input type="checkbox" checked readOnly />
                  <span>{text}</span>
                  <strong>{value}</strong>
                </label>
              </li>
            ))}
          </ul>
          <div className="ll-composer-actions">
            <Button size="sm" variant="ghost">Discard</Button>
            <Button size="sm" variant="primary" icon="check">Add 2 to scenario</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DraftBeat() {
  const t = useT();
  return (
    <div className="ac-draft" style={{ ["--glow" as string]: clamp((t - 0.6) * 2) }}>
      <BoardWidget />
    </div>
  );
}

export const ACTION_BEATS: Array<[number, number]> = [
  [0, 3.9],
  [3.9, 3.5],
  [7.4, 2.7],
  [10.1, 3.9],
  [14.0, 3.5],
];
export const ACTIONS_LENGTH = 17.5;

/** 55–72.5s: five AI actions, one verb each, at the pace of a trailer. */
export function Actions() {
  const t = useT();
  const [s, e, x, p, d] = ACTION_BEATS;
  return (
    <div className="fx-scene">
      <Aurora strength={0.8} hue="forecast" />
      <Chapter n="04" name="AI actions, in place" at={0} out={ACTIONS_LENGTH - 0.5} />
      <div className="ac-progress">
        {ACTION_BEATS.map(([at, dur], i) => (
          <i key={i}>
            <b style={{ transform: `scaleX(${clamp((t - at) / dur)})` }} />
          </i>
        ))}
      </div>
      <Seq at={s[0]} dur={s[1]}>
        <Beat n={1} verb="Search." line="Search the ledger in your own words. It becomes filters you can see.">
          <SearchBeat />
        </Beat>
      </Seq>
      <Seq at={e[0]} dur={e[1]}>
        <Beat n={2} verb="Explain." line="Click any line of a statement for the reason, traced to its journals.">
          <ExplainBeat />
        </Beat>
      </Seq>
      <Seq at={x[0]} dur={x[1]}>
        <Beat n={3} verb="Flag." line="Unusual movements, spotted before you go looking.">
          <FlagBeat />
        </Beat>
      </Seq>
      <Seq at={p[0]} dur={p[1]}>
        <Beat n={4} verb="Plan." line="A plan from a sentence. You check it before anything is saved.">
          <PlanBeat />
        </Beat>
      </Seq>
      <Seq at={d[0]} dur={d[1]}>
        <Beat n={5} verb="Draft." line="A board pack that writes itself, and cites every number.">
          <DraftBeat />
        </Beat>
      </Seq>
    </div>
  );
}
