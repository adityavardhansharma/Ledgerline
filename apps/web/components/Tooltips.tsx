"use client";

import { createTooltipController, Tooltip, TooltipContent } from "@ui-sdk/react/tooltip";
import { useEffect, useRef, useState } from "react";

/**
 * One tooltip for the whole app. Any element with a title shows it in the design system's style instead of the
 * browser's: after a short pause on hover, at once on keyboard focus, above the element unless there's no room.
 * The title moves to data-title so the native one never appears; text like "Label · source" puts the part before
 * the dot first, in bold. One ui-sdk tooltip shows them all, anchored to whichever element is pointed at.
 */
export function Tooltips() {
  const [tip] = useState(() => createTooltipController<string>());
  const current = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const hide = () => {
      clearTimeout(timer.current);
      current.current = null;
      tip.close();
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.title;
      if (!text || !el.isConnected) return;
      void tip.open({ payload: text, anchor: el });
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
  }, [tip]);

  return (
    <Tooltip controller={tip}>
      <TooltipContent className="ll-tooltip" side="top" sideOffset={8} collisionPadding={8}>
        {(state: { payload?: unknown }) => {
          const [head, ...rest] = String(state.payload ?? "").split(" · ");
          return rest.length ? (
            <>
              <b>{head}</b>
              <span>{rest.join(" · ")}</span>
            </>
          ) : (
            head
          );
        }}
      </TooltipContent>
    </Tooltip>
  );
}
