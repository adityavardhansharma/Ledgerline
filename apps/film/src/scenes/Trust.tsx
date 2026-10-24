import { AuditTimeline, Icon } from "@ledgerline/ui";
import { memo } from "react";
import { Aurora, Chapter, Words } from "../lib/fx";
import { backOut, clamp, expoOut, prog, useT } from "../lib/time";

type Part = string | { text: string; source: string } | { text: string; bad: true };

const DRAFT: Part[] = [
  "September revenue was ",
  { text: "€246,281", source: "Profit and loss · Sep 2026" },
  ", up ",
  { text: "16.9%", source: "Statement · previous month" },
  " on August. Cash fell ",
  { text: "€50,497", source: "Cash flow · Sep 2026" },
  " in a profitable month, as customers paid later. Next quarter should bring in ",
  { text: "€750,000", bad: true },
  ".",
];

/** The board pack's rule, shown: a cited figure stays, a number the model wrote itself is struck out. */
function Validator() {
  const t = useT();
  const scan = prog(t, 1.4, 3.0, (p) => p);
  const reject = prog(t, 3.0, 3.25, expoOut);
  const gone = prog(t, 3.9, 4.4);
  const sources = prog(t, 4.3, 4.8, expoOut);
  let cite = 0;
  return (
    <div className="tr-paper" style={{ opacity: prog(t, 0.6, 1.2), transform: `translateY(${(1 - prog(t, 0.6, 1.4, expoOut)) * 60}px)` }}>
      <div className="tr-paper-head">
        <span>Board pack · Performance</span>
        <span className="tr-check" style={{ opacity: prog(t, 1.3, 1.5) }}>
          <Icon name="reconcile" size={14} /> Checking every figure
        </span>
      </div>
      <p className="tr-text">
        {DRAFT.map((part, i) => {
          if (typeof part === "string") {
            if (!part.includes(" Next")) return <span key={i}>{part}</span>;
            const [keep, drop] = part.split(" Next");
            return (
              <span key={i}>
                {keep}
                <span className="tr-dropped" style={{ opacity: 1 - gone, maxWidth: `${(1 - gone) * 900}px` }}>
                  {"\u00a0"}Next{drop}
                </span>
              </span>
            );
          }
          if ("bad" in part) {
            return (
              <span key={i} className="tr-bad" style={{ opacity: 1 - gone, maxWidth: `${(1 - gone) * 300}px` }}>
                <span className="tr-bad-num" style={{ ["--x" as string]: reject }}>
                  {part.text}
                </span>
                <span className="tr-bad-tag" style={{ opacity: reject * (1 - gone), transform: `translateX(-50%) scale(${0.6 + backOut(reject) * 0.4})` }}>
                  <Icon name="error" size={14} /> Rejected · not a citation
                </span>
              </span>
            );
          }
          const n = cite++;
          const lit = scan > (n + 1) / 4.2;
          return (
            <span key={i} className="tr-cite-wrap">
              <span className={`ll-cite tr-cite${lit ? " is-lit" : ""}`}>{part.text}</span>
              <span className="tr-src" style={{ opacity: sources, transform: `translate(-50%, ${(1 - sources) * -8}px)`}}>
                {part.source}
              </span>
            </span>
          );
        })}
      </p>
      <div className="tr-scan" style={{ left: `${scan * 100}%`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
    </div>
  );
}

const AUDIT = [
  {
    day: "Today",
    items: [
      { actor: "Ledgerline", action: "synced from Xero", target: "Kestrel Joinery Ltd", detail: "2,412 journals · matches Xero to the cent", at: "07:02", icon: "sync" as const, tone: "brand" as const },
      { actor: "Aoife Byrne", action: "accepted the board pack", target: "September 2026", at: "09:14", icon: "boardpack" as const, tone: "positive" as const },
      { actor: "Ciarán Walsh", action: "exported", target: "Profit and loss, CSV", detail: "Accountant · read only", at: "10:31", icon: "download" as const },
      { actor: "Aoife Byrne", action: "branched", target: "Hire two fitters", detail: "from Base case", at: "11:05", icon: "branch" as const, tone: "forecast" as const },
    ],
  },
];

const Audit = memo(function Audit() {
  return <AuditTimeline groups={AUDIT} />;
});

const PILLARS: Array<[string, string, string]> = [
  ["lock", "Read-only by design", "It can't write to Xero. Tokens are encrypted and never reach your browser."],
  ["organisation", "Isolated organisations", "Every query is scoped to your organisation, with roles for owners, editors and accountants."],
  ["eye", "Private by default", "The AI sees only your figures, only the parts it needs. Your questions stay yours."],
  ["audit", "Append-only audit log", "Every sync, change and export is recorded, and nothing in it can be edited."],
];

/** 83–96s: the AI can't invent a number; the books are read-only, private and on the record. */
export function Trust() {
  const t = useT();
  const partA = 1 - prog(t, 5.6, 6.1);
  const partB = prog(t, 6.0, 6.6, expoOut);
  const out = prog(t, 12.5, 13);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out }}>
      <Aurora strength={0.7} />
      <Chapter n="06" name="Trust and privacy" at={0} />
      {partA > 0 ? (
        <div className="fx-scene" style={{ opacity: partA, filter: partA < 1 ? `blur(${(1 - partA) * 12}px)` : undefined }}>
          <div className="tr-head t-big">
            <Words text="The AI can't *make up* a number." at={0.1} stagger={0.08} />
          </div>
          <Validator />
          <p className="t-small tr-note" style={{ opacity: prog(t, 4.6, 5.1) }}>
            Every figure it writes is a citation of something Ledgerline computed. Hover any number for its source.
          </p>
        </div>
      ) : null}
      {partB > 0 ? (
        <div className="fx-scene" style={{ opacity: partB }}>
          <div className="tr-head2 t-big">
            <Words text="Built like it's *holding your books.*" at={6.0} stagger={0.08} />
          </div>
          <div className="tr-pillars">
            {PILLARS.map(([icon, title, text], i) => {
              const p = prog(t, 6.6 + i * 0.22, 7.4 + i * 0.22, expoOut);
              return (
                <div key={title} className="tr-pillar" style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
                  <span className="tr-pillar-icon" style={{ boxShadow: `0 0 ${clamp((t - 7 - i * 0.22) * 2) * 40}px -6px rgba(69,192,143,.6)` }}>
                    <Icon name={icon as never} size={30} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              );
            })}
          </div>
          <div className="tr-audit" style={{ opacity: prog(t, 8.6, 9.2), transform: `translateY(${(1 - prog(t, 8.6, 9.6, expoOut)) * 50}px)` }}>
            <div className="tr-audit-cap t-mono">Audit log · nothing in it can be edited</div>
            <div className="tr-audit-zoom">
              <Audit />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
