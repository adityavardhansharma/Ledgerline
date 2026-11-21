"use client";

import { useEffect, useState } from "react";

/** The pill that opens the chat in the app, as it sits at the bottom of every page. */
export function AskPill() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <a href="#ask" className="lp-pill" aria-label="See Ask Ledgerline">
      <span className="ll-ask-orb" aria-hidden />
      <span>Ask Ledgerline</span>
      <kbd>{mac ? "⌘ J" : "Ctrl J"}</kbd>
    </a>
  );
}
