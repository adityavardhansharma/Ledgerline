"use client";

import { useEffect, type RefObject } from "react";

/**
 * Blocks glide across a layout jump instead of teleporting.
 *
 * Between breakpoints a block moves in a straight line with the page width, so its next position is predicted by
 * f(W + ΔW) ≈ f(W) + J·ΔW, with J its slope from the last frame. Whatever the prediction misses is a jump: a column
 * folds, a section above gains a line, a forecast arrives and adds a warning. Only that residual is animated, from
 * where the block was to where it now is, with smoothstep timing t²(3 − 2t): the jump softened into a sigmoid.
 *
 * While it travels a block lifts by its speed, as the imaginary part of the softened layout does
 * (Im f(x + iε) ≈ ε f′(x)): lift w = (relative speed)^0.7, rendered as a slight scale and a deeper shadow. A block
 * that doesn't move stays flat; the one that travels furthest lifts highest, at the middle of its trip, then lands.
 */
const STEPS = 24;
// A residual this small is a line of text or rounding, not a jump.
const JUMP_PX = 10;

type Track = { x: number; y: number; jx: number; jy: number };

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function useGlide(container: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const root = container.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tracks = new WeakMap<Element, Track>();
    let lastWidth = root.getBoundingClientRect().width;

    // Where the layout puts a block's centre, ignoring any glide in flight: the box's centre less its translation.
    // Scale is applied about the centre, so it leaves the centre where it is.
    const place = (el: HTMLElement, origin: DOMRect) => {
      const r = el.getBoundingClientRect();
      const transform = getComputedStyle(el).transform;
      const m = new DOMMatrixReadOnly(transform === "none" ? undefined : transform);
      return { x: r.left + r.width / 2 - origin.left - m.m41, y: r.top + r.height / 2 - origin.top - m.m42, seenX: r.left + r.width / 2 - origin.left, seenY: r.top + r.height / 2 - origin.top };
    };

    // The innermost matches only: a block that holds other blocks lets them glide on their own, never twice over.
    const blocks = () => {
      const all = [...root.querySelectorAll<HTMLElement>(selector)];
      return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
    };

    const settle = () => {
      const origin = root.getBoundingClientRect();
      const dW = origin.width - lastWidth;
      lastWidth = origin.width;
      const jumps: { el: HTMLElement; dx: number; dy: number }[] = [];
      for (const el of blocks()) {
        const now = place(el, origin);
        const before = tracks.get(el);
        if (!before) {
          tracks.set(el, { x: now.x, y: now.y, jx: 0, jy: 0 });
          continue;
        }
        const missX = now.x - (before.x + before.jx * dW);
        const missY = now.y - (before.y + before.jy * dW);
        if (Math.hypot(missX, missY) > JUMP_PX) {
          // Start where the straight line would have put it, plus any glide still in flight; travel only the miss.
          jumps.push({ el, dx: now.seenX - now.x - missX, dy: now.seenY - now.y - missY });
          tracks.set(el, { x: now.x, y: now.y, jx: 0, jy: 0 });
        } else {
          // A straight-line stretch: learn the slope for the next frame. Steeper than 3 px per px is no stretch.
          const slope = (d: number) => (Math.abs(dW) >= 1 ? Math.max(-3, Math.min(3, d / dW)) : null);
          tracks.set(el, { x: now.x, y: now.y, jx: slope(now.x - before.x) ?? before.jx, jy: slope(now.y - before.y) ?? before.jy });
        }
      }
      if (still.matches || !jumps.length) return;
      const furthest = Math.max(...jumps.map((j) => Math.hypot(j.dx, j.dy)));
      for (const { el, dx, dy } of jumps) {
        const distance = Math.hypot(dx, dy);
        if (distance < 1) continue;
        // The same lift in pixels for a narrow figure and a full-width section: at most 16px wider at the top.
        const grow = Math.min(0.02, 16 / Math.max(1, el.offsetWidth));
        el.getAnimations().forEach((a) => a.id === "glide" && a.cancel());
        // Speed is distance · smoothstep′(t) = distance · 6t(1 − t); relative to the fastest block's peak, 1.5 · furthest.
        const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
          const t = i / STEPS;
          const left = 1 - smoothstep(t);
          const w = ((distance / furthest) * 4 * t * (1 - t)) ** 0.7;
          return {
            transform: `translate(${dx * left}px, ${dy * left}px) scale(${1 + grow * w})`,
            boxShadow: w > 0.01 ? `0 ${2 + 28 * w}px ${8 + 56 * w}px rgba(0, 0, 0, ${0.06 + 0.16 * w})` : "none",
            zIndex: String(1 + Math.round(10 * w)),
          };
        });
        const animation = el.animate(frames, { duration: Math.min(560, 200 + 14 * Math.sqrt(distance)), easing: "linear" });
        animation.id = "glide";
      }
    };

    const observer = new ResizeObserver(settle);
    const watch = () => {
      observer.observe(root);
      blocks().forEach((el) => observer.observe(el));
    };
    watch();
    // Blocks that arrive later (a chart once its data loads) are watched too.
    const mutations = new MutationObserver(() => {
      watch();
      settle();
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [container, selector]);
}
