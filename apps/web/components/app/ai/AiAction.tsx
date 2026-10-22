"use client";

import { Icon, IconButton, Skeleton } from "@ledgerline/ui";
import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Prose } from "@/convex/commentary";
import { errorText, Text } from "../BoardCommentary";

/**
 * The shared look of AI actions: a quiet sparkle button that says what it will do, and an inline note for the
 * answer. Figures inside an answer are citations of the accounts, the same as in the board pack.
 */
export function AiButton({ children, onClick, busy, size = "md", title }: { children: ReactNode; onClick: () => void; busy?: boolean; size?: "sm" | "md"; title?: string }) {
  return (
    <button type="button" className={`ll-ai-btn is-${size}${busy ? " is-busy" : ""}`} onClick={onClick} disabled={busy} title={title} aria-busy={busy}>
      <Icon name="sparkle" size={size === "sm" ? 13 : 14} />
      <span>{busy ? "Thinking…" : children}</span>
    </button>
  );
}

export function AiNote({ title, children, onClose, footer, busy, error }: { title: string; children?: ReactNode; onClose?: () => void; footer?: ReactNode; busy?: boolean; error?: string | null }) {
  return (
    <section className="ll-ai-note" aria-live="polite">
      <header>
        <span className="ll-ai-note-title">
          <Icon name="sparkle" size={13} /> {title}
        </span>
        {onClose ? <IconButton icon="close" label="Close" size="sm" onClick={onClose} /> : null}
      </header>
      {error ? <p className="ll-ai-error">{error}</p> : busy ? <Skeleton lines={3} /> : children}
      {footer && !busy && !error ? <footer>{footer}</footer> : null}
    </section>
  );
}

export function AiProse({ paragraphs }: { paragraphs: Prose[] }) {
  return (
    <div className="ll-ai-prose">
      {paragraphs.map((p, i) => (
        <p key={i}>
          <Text parts={p} />
        </p>
      ))}
    </div>
  );
}

export const plainText = (parts: Prose) => parts.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** Run an action once on demand, keeping its answer, error and progress. */
export function useAi<A, R>(fn: (args: A) => Promise<R>) {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const live = useRef(0);
  const run = useCallback(
    async (args: A) => {
      const ticket = ++live.current;
      setOpen(true);
      setBusy(true);
      setError(null);
      try {
        const result = await fn(args);
        if (ticket === live.current) setData(result);
        return result;
      } catch (err) {
        if (ticket === live.current) setError(errorText(err, "That didn't work. Try again."));
        return null;
      } finally {
        if (ticket === live.current) setBusy(false);
      }
    },
    [fn],
  );
  const close = useCallback(() => {
    live.current++;
    setOpen(false);
    setBusy(false);
    setError(null);
  }, []);
  return { run, data, error, busy, open, close, setData };
}
