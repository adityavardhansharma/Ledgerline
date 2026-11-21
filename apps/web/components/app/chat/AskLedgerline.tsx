"use client";

import { Dialog, DialogBackdrop, DialogContent } from "@ui-sdk/react/dialog";
import { AnimatePresence, m as motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The panel (the chat renderer, its component library and the thread list) is most of the chat's code. It loads
// when the pill is hovered, focused or pressed, or once the browser is idle, never as part of the page itself.
const loadPanel = () => import("./ChatPanel");
const Panel = dynamic(loadPanel, { ssr: false });

// A long, soft ease-out to open (fast start, gentle landing) and a short ease-in to close.
const OPEN = { duration: 0.42, ease: [0.16, 1, 0.3, 1] } as const;
const CLOSE = { duration: 0.2, ease: [0.4, 0, 1, 1] } as const;

/**
 * Ask Ledgerline: a pill at the bottom of every page that opens into a chat about the company's own figures.
 * Answers stream in as prose, with charts, tiles and tables from the design system where a picture helps.
 */
export function AskLedgerline() {
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl J");
  const reduce = useReducedMotion();
  // The pill unmounts while the panel is open, so after closing, focus goes back to it once it's back.
  const refocus = useRef(false);
  const close = () => {
    refocus.current = true;
    setOpen(false);
  };
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘J");
  }, []);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 3000));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => void loadPanel(), { timeout: 8000 } as never);
    return () => cancel(handle as never);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((x) => !x);
      }
    };
    const onAsk = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ll-ask-open", onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ll-ask-open", onAsk);
    };
  }, []);

  return (
    <>
      {/* The panel rises from where the pill sits; the pill steps aside. Nothing stretches, so text never warps.
          The dialog stays mounted, and open, until motion's exit finishes. */}
      <AnimatePresence>
        {open ? (
          <Dialog key="ask" open modal closeOnOutsidePress onOpenChange={(next) => !next && close()}>
            <DialogBackdrop
              render={
                <motion.div
                  className="ll-ask-scrim no-print"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
                  exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
                />
              }
            />
            <DialogContent
              aria-label="Ask Ledgerline"
              initialFocus="textarea"
              render={
                <motion.section
                  className="ll-ask-panel no-print"
                  style={{ transformOrigin: "50% 100%" }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.965 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0.15 } : OPEN }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 18, scale: 0.98, transition: CLOSE }}
                />
              }
            >
              <Panel onClose={close} />
            </DialogContent>
          </Dialog>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {open ? null : (
          <motion.button
            key="pill"
            type="button"
            className="ll-ask-pill no-print"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0.15 } : { ...OPEN, delay: 0.08 } }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 8, scale: 0.94, transition: { duration: 0.16, ease: "easeIn" } }}
            ref={(el: HTMLButtonElement | null) => {
              if (el && refocus.current) {
                refocus.current = false;
                el.focus({ preventScroll: true });
              }
            }}
            onClick={() => setOpen(true)}
            onPointerEnter={() => void loadPanel()}
            onFocus={() => void loadPanel()}
            whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="ll-ask-pill-inner">
              <span className="ll-ask-orb" aria-hidden />
              <span>Ask Ledgerline</span>
              <kbd>{shortcut}</kbd>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

