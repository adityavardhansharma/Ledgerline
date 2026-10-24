import { Fragment, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clamp, easeOut, expoOut, keys, prog, rand, useT } from "./time";

/**
 * Words that arrive one after another: each rises, sharpens out of a blur and fades up. *Asterisks* mark words set in
 * the emerald italic. Leaving, they lift and blur away together.
 */
export function Words({ text, at = 0, stagger = 0.07, dur = 0.7, out, className, style, rise = 28 }: { text: string; at?: number; stagger?: number; dur?: number; out?: number; className?: string; style?: CSSProperties; rise?: number }) {
  const t = useT();
  const tokens = useMemo(() => {
    const list: { word: string; em: boolean; br: boolean }[] = [];
    let em = false;
    for (const raw of text.split(/(\s+)/)) {
      if (!raw.trim()) {
        if (raw.includes("\n")) list.push({ word: "", em: false, br: true });
        continue;
      }
      let w = raw;
      const opens = w.startsWith("*");
      if (opens) {
        em = true;
        w = w.slice(1);
      }
      const closes = w.endsWith("*") || /\*[.,!?]$/.test(w);
      w = w.replace("*", "");
      list.push({ word: w, em, br: false });
      if (closes) em = false;
    }
    return list;
  }, [text]);
  const leave = out === undefined ? 0 : prog(t, out, out + 0.5, (p) => p * p);
  let n = 0;
  return (
    <span className={`fx-words ${className ?? ""}`} style={style}>
      {tokens.map((tok, i) => {
        if (tok.br) return <br key={i} />;
        const p = prog(t, at + n++ * stagger, at + (n - 1) * stagger + dur, expoOut);
        const Tag = tok.em ? "em" : "span";
        return (
          <Fragment key={i}>
            <Tag
              className="fx-word"
              style={{
                opacity: p * (1 - leave),
                transform: `translateY(${(1 - p) * rise - leave * 20}px)`,
                filter: `blur(${(1 - p) * 14 + leave * 12}px)`,
              }}
            >
              {tok.word}
            </Tag>{" "}
          </Fragment>
        );
      })}
    </span>
  );
}

/** Text typed in at a steady pace, with a caret while it types. */
export function Typed({ text, at, cps = 22, caret = true }: { text: string; at: number; cps?: number; caret?: boolean }) {
  const t = useT();
  const n = clamp(Math.floor((t - at) * cps), 0, text.length);
  const typing = t >= at - 0.4 && n < text.length;
  return (
    <>
      {text.slice(0, n)}
      {caret && (typing || (n === text.length && Math.floor(t * 2) % 2 === 0 && t < at + text.length / cps + 1.2)) ? <i className="fx-caret" /> : null}
    </>
  );
}

/** A figure that counts up to its value. */
export function Count({ to, at, dur = 1.2, format }: { to: number; at: number; dur?: number; format: (v: number) => string }) {
  const t = useT();
  return <>{format(to * prog(t, at, at + dur, expoOut))}</>;
}

/** The pointer from the homepage scenes, driven by keyframes, with a ring at each click. */
export function Cursor({ path, clicks = [], hideAt }: { path: Array<[number, number, number]>; clicks?: number[]; hideAt?: number }) {
  const t = useT();
  const x = keys(t, path.map(([at, px]) => [at, px]));
  const y = keys(t, path.map(([at, , py]) => [at, py]));
  const shown = prog(t, path[0][0] - 0.3, path[0][0]) * (hideAt === undefined ? 1 : 1 - prog(t, hideAt, hideAt + 0.25));
  const click = clicks.filter((c) => t >= c).at(-1);
  const since = click === undefined ? 9 : t - click;
  const press = since < 0.18 ? 0.86 + (since / 0.18) * 0.14 : 1;
  const film = document.querySelector(".film");
  const el = (
    <div className="fx-cursor" style={{ transform: `translate(${x}px, ${y}px)`, opacity: shown }}>
      {since < 0.6 ? <span className="fx-cursor-ring" style={{ transform: `scale(${0.3 + (since / 0.6) * 1.6})`, opacity: 0.8 * (1 - since / 0.6) }} /> : null}
      <svg width="27" height="33" viewBox="0 0 18 22" style={{ transform: `scale(${press})` }}>
        <path d="M1.5 1.5v16.2l4.3-4.1 2.9 6.6 3-1.3-2.9-6.5h6z" fill="#fff" stroke="#0e1613" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
  // Drawn on the film itself, so it lands where the anchors were measured whatever zoom or tilt its scene has.
  return film ? createPortal(el, film) : el;
}

/** A small mono label, top left: the chapter number and its name, with a hairline that draws in. */
export function Chapter({ n, name, at = 0, out }: { n: string; name: string; at?: number; out?: number }) {
  const t = useT();
  const p = prog(t, at, at + 0.9, expoOut);
  const o = out === undefined ? 1 : 1 - prog(t, out, out + 0.4);
  return (
    <div className="fx-chapter" style={{ opacity: p * o }}>
      <span className="fx-chapter-n">{n}</span>
      <i style={{ transform: `scaleX(${p})` }} />
      <span className="fx-chapter-name">{name}</span>
    </div>
  );
}

/** Film grain that moves every frame, a vignette, and slow light. Always on top, never in the way. */
export function Grain() {
  const t = useT();
  const noise = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.floor(rand(i + 1) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, []);
  const f = Math.floor(t * 24);
  return (
    <>
      <div className="fx-grain" style={{ backgroundImage: `url(${noise})`, backgroundPosition: `${Math.floor(rand(f) * 256)}px ${Math.floor(rand(f + 99) * 256)}px` }} />
      <div className="fx-vignette" />
    </>
  );
}

/** Slow emerald and indigo light drifting behind a scene. */
export function Aurora({ strength = 1, hue = "brand" }: { strength?: number; hue?: "brand" | "forecast" | "mixed" | "negative" }) {
  const t = useT();
  const a = Math.sin(t * 0.35) * 120;
  const b = Math.cos(t * 0.27) * 90;
  const c1 = hue === "forecast" ? "144,154,240" : hue === "negative" ? "255,125,114" : "69,192,143";
  const c2 = hue === "brand" ? "69,192,143" : "144,154,240";
  return (
    <div
      className="fx-aurora"
      style={{
        opacity: strength,
        background: `radial-gradient(900px 520px at ${30 + a / 20}% ${20 + b / 30}%, rgba(${c1},.16), transparent 70%), radial-gradient(800px 600px at ${75 - a / 25}% ${80 - b / 25}%, rgba(${c2},.11), transparent 70%)`,
      }}
    />
  );
}

/** A full-frame layer whose children are transformed by a camera: x/y in px, scale, and a 3D tilt. */
export function Camera({ x = 0, y = 0, scale = 1, rx = 0, ry = 0, rz = 0, children, origin = "50% 50%", style }: { x?: number; y?: number; scale?: number; rx?: number; ry?: number; rz?: number; children: ReactNode; origin?: string; style?: CSSProperties }) {
  return (
    <div className="fx-camera">
      <div className="fx-camera-rig" style={{ transformOrigin: origin, transform: `translate3d(${x}px, ${y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`, ...style }}>
        {children}
      </div>
    </div>
  );
}

/** Fades a whole scene in and out at its edges, optionally with a quick white-hot flash or a blur. */
export function SceneFade({ length, fadeIn = 0.5, fadeOut = 0.5, children, blur = true }: { length: number; fadeIn?: number; fadeOut?: number; children: ReactNode; blur?: boolean }) {
  const t = useT();
  const i = fadeIn ? prog(t, 0, fadeIn, easeOut) : 1;
  const o = fadeOut ? 1 - prog(t, length - fadeOut, length, (p) => p * p) : 1;
  const v = Math.min(i, o);
  return <div className="fx-scene" style={{ opacity: v, filter: blur && v < 1 ? `blur(${(1 - v) * 10}px)` : undefined }}>{children}</div>;
}

/** A thin emerald rule that draws itself; double, like the line under a total, once `double` is past. */
export function LedgerRule({ p, double = 0, width = 1100, glow = 1 }: { p: number; double?: number; width?: number; glow?: number }) {
  return (
    <div className="fx-rule" style={{ width }}>
      <i style={{ transform: `scaleX(${p})`, boxShadow: `0 0 ${24 * glow}px rgba(69,192,143,${0.8 * glow}), 0 0 ${80 * glow}px rgba(69,192,143,${0.35 * glow})` }} />
      <i style={{ transform: `scaleX(${p * double}) translateY(${double * 9}px)`, opacity: double }} />
    </div>
  );
}

/**
 * Named elements whose centres the cursor can travel to, measured every frame in film pixels, so a path follows the
 * real layout of the product's components instead of guessed coordinates.
 */
export function useAnchors() {
  const els = useRef(new Map<string, HTMLElement | null>());
  const [, force] = useState(0);
  const spots = useRef(new Map<string, [number, number]>());
  useLayoutEffect(() => {
    const film = document.querySelector(".film") as HTMLElement | null;
    if (!film) return;
    const f = film.getBoundingClientRect();
    const k = f.width / 1920;
    let changed = false;
    for (const [name, el] of els.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const spot: [number, number] = [(r.left + Math.min(r.width / 2, 60) - f.left) / k, (r.top + r.height / 2 - f.top) / k];
      const was = spots.current.get(name);
      if (!was || Math.abs(was[0] - spot[0]) > 0.5 || Math.abs(was[1] - spot[1]) > 0.5) {
        spots.current.set(name, spot);
        changed = true;
      }
    }
    if (changed) force((n) => n + 1);
  });
  return {
    ref: (name: string) => (el: HTMLElement | null) => void els.current.set(name, el),
    at: (name: string, fallback: [number, number] = [960, 540]): [number, number] => spots.current.get(name) ?? fallback,
  };
}
