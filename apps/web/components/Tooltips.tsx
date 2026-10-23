"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Tip = { text: string; x: number; y: number; below: boolean };

/**
 * One tooltip for the whole app. Any element with a title shows it in the design system's style instead of the
 * browser's: after a short pause on hover, at once on keyboard focus, above the element unless there's no room.
 * The title moves to data-title so the native one never appears; text like "Label · source" puts the part before
 * the dot first, in bold.
 */
export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const hide = () => {
      clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.title;
      if (!text || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 64;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const target = (node: EventTarget | null) => {
      const el = (node as HTMLElement | null)?.closest?.("[title], [data-title]") as HTMLElement | null;
      if (!el || el.closest("svg") || el.closest("[data-no-tooltip]")) return null;
      const title = el.getAttribute("title");
      if (title) {
        el.dataset.title = title;
        el.removeAttribute("title");
        // Keep an accessible name for icon-only controls that relied on the title.
        if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", title);
      }
      return el.dataset.title ? el : null;
    };
    const over = (e: MouseEvent) => {
      const el = target(e.target);
      if (el === current.current) return;
      hide();
      if (!el) return;
      current.current = el;
      timer.current = setTimeout(() => show(el), 320);
    };
    const focus = (e: FocusEvent) => {
      const el = target(e.target);
      if (!el || !(e.target as HTMLElement).matches?.(":focus-visible")) return;
      hide();
      current.current = el;
      show(el);
    };
    window.addEventListener("mouseover", over, true);
    window.addEventListener("focusin", focus, true);
    window.addEventListener("focusout", hide, true);
    window.addEventListener("mousedown", hide, true);
    window.addEventListener("scroll", hide, true);
    const key = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("mouseover", over, true);
      window.removeEventListener("focusin", focus, true);
      window.removeEventListener("focusout", hide, true);
      window.removeEventListener("mousedown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", key, true);
      clearTimeout(timer.current);
    };
  }, []);

  if (!tip || typeof document === "undefined") return null;
  const [head, ...rest] = tip.text.split(" · ");
  // Keep the bubble on screen near the edges; the arrow still points at the element.
  const half = Math.min(150, (tip.text.length * 6.5 + 20) / 2);
  const left = Math.min(window.innerWidth - half - 8, Math.max(half + 8, tip.x));
  return createPortal(
    <div className={`ll-tooltip${tip.below ? " is-below" : ""}`} role="tooltip" style={{ left, top: tip.y, "--arrow": `${tip.x - left}px` } as React.CSSProperties}>
      {rest.length ? (
        <>
          <b>{head}</b>
          <span>{rest.join(" · ")}</span>
        </>
      ) : (
        head
      )}
    </div>,
    document.body,
  );
}
