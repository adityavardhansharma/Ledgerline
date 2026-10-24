import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The film's clock. Every scene reads its own local time in seconds and derives everything it shows from it, so a
 * frame is a pure function of time. While rendering, performance.now and requestAnimationFrame are virtual
 * (render/virtual-time.js), so this clock steps exactly one frame at a time.
 */

const Time = createContext(0);
const Length = createContext(Infinity);

export const useT = () => useContext(Time);
export const useLength = () => useContext(Length);

export function Clock({ seek = 0, length, children, onReady }: { seek?: number; length: number; children: ReactNode; onReady?: () => void }) {
  const [t, setT] = useState(seek);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t0 = performance.now();
    let frame = 0;
    const loop = () => {
      const now = seek + (performance.now() - t0) / 1000;
      // In a browser preview the film loops; when rendering it simply runs to the end.
      setT((window as { __virtualTime?: boolean }).__virtualTime ? now : seek + ((now - seek) % (length - seek)));
      frame = requestAnimationFrame(loop);
    };
    loop();
    onReady?.();
    return () => cancelAnimationFrame(frame);
  }, [ready, seek, length, onReady]);
  return <Time.Provider value={ready ? t : seek}>{ready ? children : null}</Time.Provider>;
}

/** Shows its children from `at` for `dur` seconds, giving them time measured from their own start. */
export function Seq({ at, dur, children }: { at: number; dur: number; children: ReactNode }) {
  const t = useT();
  if (t < at || t >= at + dur) return null;
  return (
    <Length.Provider value={dur}>
      <Time.Provider value={t - at}>{children}</Time.Provider>
    </Length.Provider>
  );
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const linear = (p: number) => p;
export const easeIn = (p: number) => p * p * p;
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const expoOut = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const expoInOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);
export const backOut = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

/** 0 → 1 between two times, eased. */
export const prog = (t: number, a: number, b: number, ease: (p: number) => number = easeInOut) => ease(clamp((t - a) / (b - a)));

/** A damped spring from 0 to 1, started at `at`. */
export function spring(t: number, at = 0, { stiffness = 140, damping = 18, mass = 1 } = {}) {
  const x = t - at;
  if (x <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * x) * (Math.cos(wd * x) + ((zeta * w0) / wd) * Math.sin(wd * x));
  }
  return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
}

/** In, hold, out: 0 → 1 over `fade` after `a`, back to 0 over `fade` before `b`. */
export const window_ = (t: number, a: number, b: number, fade = 0.4, ease = easeInOut) => Math.min(prog(t, a, a + fade, ease), 1 - prog(t, b - fade, b, ease));

/** Piecewise keyframes: [[time, value], ...], eased between each pair. */
export function keys(t: number, frames: Array<[number, number]>, ease: (p: number) => number = easeInOut) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    const [t0, v0] = frames[i - 1];
    if (t <= t1) return lerp(v0, v1, ease(clamp((t - t0) / (t1 - t0 || 1))));
  }
  return frames[frames.length - 1][1];
}

/** A deterministic pseudo-random number in [0, 1) for a seed. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
