import { Button, Icon, Logo } from "@ledgerline/ui";
import type { ReactNode } from "react";
import { Aurora, LedgerRule, Words } from "../lib/fx";
import { expoOut, prog, useLength, useT } from "../lib/time";

/**
 * The pieces every vertical short shares. The frame is 1080×1920; Reels and Shorts cover roughly the top 220 px and
 * the bottom 380 px with their own interface, so anything that has to be read sits between those.
 */

/** The short's backdrop, the brand mark at the top, and the end card for its last `end` seconds. */
export function ShortFrame({ children, hue = "brand", end = 3.6 }: { children: ReactNode; hue?: "brand" | "forecast" | "negative" | "mixed"; end?: number }) {
  const t = useT();
  const len = useLength();
  const endAt = len - end;
  const body = 1 - prog(t, endAt - 0.4, endAt);
  return (
    <div className="fx-scene">
      <Aurora strength={0.9} hue={hue} />
      <div className="sh-bug" style={{ opacity: prog(t, 0, 0.5) * body }}>
        <Logo size={40} />
      </div>
      {body > 0 ? (
        <div className="fx-scene" style={{ opacity: body, filter: body < 1 ? `blur(${(1 - body) * 12}px)` : undefined }}>
          {children}
        </div>
      ) : null}
      {t >= endAt - 0.2 ? <EndCard at={endAt} /> : null}
    </div>
  );
}

/** The opening line, large, then it shrinks up out of the way at `settle`. */
export function Hook({ text, settle = 2.2 }: { text: string; settle?: number }) {
  const t = useT();
  const s = prog(t, settle, settle + 0.7, expoOut);
  return (
    <div className="sh-hook" style={{ transform: `translateY(${-s * 70}px) scale(${1 - s * 0.45})` }}>
      <Words text={text} at={0.1} stagger={0.07} rise={36} />
    </div>
  );
}

/** A line under the product that swaps as the story moves: [[from, text], ...]. */
export function Caption({ lines, top = 1500 }: { lines: Array<[number, string]>; top?: number }) {
  const t = useT();
  return (
    <>
      {lines.map(([at, text], i) => {
        const until = lines[i + 1]?.[0] ?? Infinity;
        if (t < at - 0.1 || t > until + 0.5) return null;
        return (
          <div key={at} className="sh-caption" style={{ top }}>
            <Words text={text} at={at} out={until === Infinity ? undefined : until - 0.1} stagger={0.05} rise={20} />
          </div>
        );
      })}
    </>
  );
}

/** The product, centred and enlarged, rising in at `at`. */
export function Product({ children, at = 0.8, top = 520, zoom = 1.6, width = 600 }: { children: ReactNode; at?: number; top?: number; zoom?: number; width?: number }) {
  const t = useT();
  const p = prog(t, at, at + 0.9, expoOut);
  return (
    <div className="sh-product" style={{ top, opacity: p, transform: `translateY(${(1 - p) * 120}px) scale(${0.94 + p * 0.06})` }}>
      <div style={{ zoom, width }}>{children}</div>
    </div>
  );
}

function EndCard({ at }: { at: number }) {
  const t = useT() - at;
  return (
    <div className="fx-scene sh-end" style={{ opacity: prog(t, -0.2, 0.3) }}>
      <div className="sh-end-in">
        <div style={{ opacity: prog(t, 0, 0.5), transform: `translateY(${(1 - prog(t, 0, 0.8, expoOut)) * 30}px)` }}>
          <Logo size={88} />
        </div>
        <div className="sh-end-line">
          <Words text="Know your cash" at={at + 0.25} stagger={0.07} />
          <br />
          <Words text="*every morning.*" at={at + 0.6} stagger={0.1} />
        </div>
        <div className="sh-end-cta" style={{ opacity: prog(t, 1.2, 1.7), transform: `translateY(${(1 - prog(t, 1.2, 2, expoOut)) * 24}px)` }}>
          <Button variant="primary" size="lg" iconRight="arrow-right">
            Connect Xero
          </Button>
          <Button size="lg" icon="upload">
            Upload CSV
          </Button>
        </div>
        <ul className="sh-end-proof" style={{ opacity: prog(t, 1.8, 2.3) }}>
          <li>
            <Icon name="lock" size={22} /> Read-only Xero access
          </li>
          <li>
            <Icon name="reconcile" size={22} /> Matches Xero to the cent
          </li>
        </ul>
        <div className="sh-end-rule">
          <LedgerRule p={prog(t, 1.9, 3.0, expoOut)} double={prog(t, 2.6, 3.3, expoOut)} width={620} glow={0.8} />
        </div>
        <div className="t-mono sh-end-free" style={{ opacity: prog(t, 2.2, 2.7) }}>
          Start free
        </div>
      </div>
    </div>
  );
}
