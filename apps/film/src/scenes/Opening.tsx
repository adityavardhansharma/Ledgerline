import { Logo } from "@ledgerline/ui";
import { memo } from "react";
import { Aurora, Camera, LedgerRule, Words } from "../lib/fx";
import { clamp, easeIn, expoOut, keys, prog, rand, spring, useT } from "../lib/time";

/** Columns of journal amounts falling behind the titles: the ledger as most owners see it. */
const COLUMNS = Array.from({ length: 26 }, (_, c) => ({
  speed: 30 + rand(c * 3) * 70,
  depth: rand(c * 7 + 1),
  offset: rand(c * 11 + 2) * 1400,
  lines: Array.from({ length: 46 }, (_, i) => {
    const r = rand(c * 101 + i);
    const v = Math.round(r * r * 64000 * 100) / 100;
    const neg = rand(c * 31 + i * 5) > 0.62;
    const s = v.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return neg ? `(${s})` : s;
  }),
}));

const Column = memo(function Column({ lines }: { lines: string[] }) {
  return (
    <div className="op-col-lines">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      {lines.map((l, i) => (
        <div key={`b${i}`}>{l}</div>
      ))}
    </div>
  );
});

export function LedgerRain({ opacity, speed = 1, t }: { opacity: number; speed?: number; t: number }) {
  return (
    <div className="op-rain" style={{ opacity }}>
      {COLUMNS.map((c, i) => {
        const y = -((c.offset + t * c.speed * speed * 2.2) % 1400);
        return (
          <div key={i} className="op-col" style={{ transform: `translateY(${y}px)`, filter: c.depth < 0.45 ? `blur(${(0.45 - c.depth) * 9}px)` : undefined, opacity: 0.25 + c.depth * 0.55 }}>
            <Column lines={c.lines} />
          </div>
        );
      })}
    </div>
  );
}

/** 0–7.5s: one emerald line, the ledger behind it, and the problem in two sentences. */
export function ColdOpen() {
  const t = useT();
  const rule = prog(t, 0.25, 2.0, expoOut);
  const rain = prog(t, 0.8, 3.2) * (1 - prog(t, 6.6, 7.4));
  const dbl = prog(t, 5.5, 6.2, expoOut);
  const zoom = keys(t, [[0, 1.04], [6.4, 1], [7.5, 2.6]], easeIn);
  const blur = prog(t, 6.6, 7.5, easeIn) * 16;
  const fade = 1 - prog(t, 6.9, 7.5);
  return (
    <div className="fx-scene" style={{ opacity: fade }}>
      <Camera scale={zoom} style={{ filter: blur ? `blur(${blur}px)` : undefined }}>
        <LedgerRain opacity={rain * 0.95} t={t} speed={1 + prog(t, 6.2, 7.5, easeIn) * 6} />
        <div className="op-mask" />
        <Aurora strength={rain} />
        <div className="t-center">
          <div className="op-line-text t-big">
            <Words text="Every business keeps a ledger." at={1.5} out={4.0} />
          </div>
          <div className="op-line-text t-big is-second">
            <Words text="Almost nobody can *read* it." at={4.3} out={6.7} stagger={0.09} />
          </div>
          <div style={{ marginTop: 120 }}>
            <LedgerRule p={rule} double={dbl} width={1180} glow={1 + Math.sin(t * 3) * 0.15} />
          </div>
        </div>
      </Camera>
    </div>
  );
}

const CUTS: Array<[number, number, string, string]> = [
  [0, 0.95, "2,400", "journals."],
  [0.95, 1.9, "60", "months."],
  [1.9, 2.85, "13", "accounts to check."],
  [2.85, 3.7, "One", "question."],
];

/** 7.5–13s: hard cuts of what's in the books, then the only question that matters. */
export function TheQuestion() {
  const t = useT();
  const cut = CUTS.find(([a, b]) => t >= a && t < b);
  const final = t >= 3.7;
  const ft = t - 3.7;
  const pulse = 1 + Math.max(0, Math.sin(ft * 5.2)) * 0.012 * (1 - prog(ft, 0, 1.8));
  const out = prog(t, 5.0, 5.5);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out, filter: out ? `blur(${out * 12}px)` : undefined }}>
      <LedgerRain opacity={final ? 0.25 : 0.6} t={t + 40} speed={final ? 0.4 : 3} />
      <div className="op-mask" />
      {cut ? (
        <div className="t-center" key={cut[2]}>
          <div className="q-cut" style={{ transform: `scale(${1.14 - 0.14 * expoOut(clamp((t - cut[0]) / 0.5))})` }}>
            <span className="q-num">{cut[2]}</span> <span className="q-word">{cut[3]}</span>
          </div>
        </div>
      ) : null}
      {final ? (
        <div className="t-center">
          <Aurora strength={prog(ft, 0, 1.2)} />
          <div className="t-mega" style={{ transform: `scale(${(1.06 - 0.06 * expoOut(clamp(ft / 1.4))) * pulse})` }}>
            <Words text="Are we *okay?*" at={0} stagger={0.14} dur={0.9} rise={40} />
          </div>
          <div className="q-meta" style={{ opacity: prog(ft, 0.9, 1.6) }}>
            <span>Cash at bank · 30 Sep 2026</span>
            <b>€228,780</b>
            <span className="is-neg">▼ 18.1% vs 31 Aug</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 13–19s: the mark, the name, the promise. */
export function TitleCard() {
  const t = useT();
  const sweep = prog(t, 0, 1.1, expoOut);
  const mark = spring(t, 0.45, { stiffness: 120, damping: 14 });
  const word = prog(t, 1.15, 2.1, expoOut);
  const out = prog(t, 5.4, 6);
  return (
    <div className="fx-scene" style={{ opacity: 1 - out, filter: out ? `blur(${out * 14}px)` : undefined }}>
      <Aurora strength={prog(t, 0.3, 2)} />
      <div className="ti-sweep" style={{ transform: `translateX(${-1100 + sweep * 2200}px) scaleX(${0.2 + Math.sin(sweep * Math.PI) * 1.4})`, opacity: Math.sin(sweep * Math.PI) }} />
      <div className="t-center">
        <div className="ti-logo" style={{ ["--r" as string]: `${(1 - word) * 100}%`, ["--m" as string]: mark, transform: `translateX(${(1 - word) * 300}px) scale(${0.7 + mark * 0.3})` }}>
          <div className="ti-halo" style={{ opacity: mark * (0.6 + Math.sin(t * 2) * 0.1) }} />
          <Logo size={150} />
        </div>
        <div className="t-big ti-tag">
          <Words text="Your accounts, *explained* every morning." at={2.3} stagger={0.08} />
        </div>
        <div className="t-mono ti-sub" style={{ opacity: prog(t, 3.6, 4.4), letterSpacing: `${0.16 + (1 - prog(t, 3.6, 5)) * 0.2}em` }}>
          Management accounts · Forecasts · Board packs — straight from Xero
        </div>
      </div>
    </div>
  );
}
