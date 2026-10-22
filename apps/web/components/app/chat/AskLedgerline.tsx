"use client";

import { Icon } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NAV_ITEMS, ROUTES } from "@/lib/nav";
import { ChatActions } from "./library";
import { AnswerBody, Reading } from "./Message";
import { useChatStream } from "./useChatStream";

const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

const SUGGESTIONS: Record<string, string[]> = {
  overview: ["How is cash looking?", "What changed most this month?", "Who owes us the most?", "Are we doing better than last year?"],
  pnl: ["Where do our costs go?", "Why did revenue move this month?", "Show gross margin over the year", "Which costs are growing fastest?"],
  forecast: ["When is cash lowest, and why?", "Is the base case realistic?", "Compare my scenarios", "What would another hire do to cash?"],
  default: ["How is the business doing?", "How is cash looking?", "Where do our costs go?", "Who are our biggest customers?"],
};

function usePage() {
  const path = usePathname() ?? "/";
  const item = NAV_ITEMS.find((n) => "href" in n && path.startsWith(n.href));
  const id = item && "id" in item ? item.id : "";
  const key = id === "scenarios" ? "forecast" : id in SUGGESTIONS ? id : "default";
  return { path, title: item && "label" in item ? item.label : "app", key };
}

/**
 * Ask Ledgerline: a pill at the bottom of every page that opens into a chat about the company's own figures.
 * Answers stream in as prose, with charts, tiles and tables from the design system where a picture helps.
 */
export function AskLedgerline() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((x) => !x);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <LayoutGroup>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className="ll-ask-scrim no-print"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.section
            key="panel"
            layoutId="ll-ask"
            className="ll-ask-panel no-print"
            style={{ borderRadius: 20 }}
            transition={reduce ? { duration: 0 } : SPRING}
            role="dialog"
            aria-label="Ask Ledgerline"
          >
            <Panel onClose={() => setOpen(false)} />
          </motion.section>
        ) : (
          <motion.button
            key="pill"
            layoutId="ll-ask"
            type="button"
            className="ll-ask-pill no-print"
            style={{ borderRadius: 999 }}
            transition={reduce ? { duration: 0 } : SPRING}
            onClick={() => setOpen(true)}
            whileHover={reduce ? undefined : { y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.span className="ll-ask-pill-inner" layout="position">
              <span className="ll-ask-orb" aria-hidden />
              <span>Ask Ledgerline</span>
              <kbd>⌘J</kbd>
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const page = usePage();
  const router = useRouter();
  const [threadId, setThreadId] = useState<Id<"chatThreads"> | null>(null);
  const [history, setHistory] = useState(false);
  const threads = useQuery(api.chat.threads, {});
  const stored = useQuery(api.chat.messages, threadId ? { threadId } : "skip");
  const removeThread = useMutation(api.chat.removeThread);
  const { live, send, stop, reset } = useChatStream(useCallback((id: Id<"chatThreads">) => setThreadId(id), []));
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const busy = Boolean(live && live.phase !== "done" && live.phase !== "error");

  useEffect(() => {
    const t = setTimeout(() => box.current?.focus(), 180);
    return () => clearTimeout(t);
  }, []);

  const ask = useCallback(
    (q: string) => {
      const question = q.trim();
      if (!question || busy) return;
      setText("");
      setHistory(false);
      pinned.current = true;
      void send(question, threadId, { path: page.path, title: page.title });
    },
    [busy, send, threadId, page.path, page.title],
  );
  const openPage = useCallback(
    (key: string) => {
      const href = ROUTES[key as keyof typeof ROUTES];
      if (href) {
        router.push(href);
        onClose();
      }
    },
    [router, onClose],
  );
  const actions = useMemo(() => ({ ask, open: openPage }), [ask, openPage]);

  // Messages: what's saved, with the answer being written replaced by its live copy.
  const rows = useMemo(() => {
    const saved = (stored ?? []).map((m) => ({ id: m.id as string, role: m.role, content: m.content, status: m.status as string }));
    if (!live) return saved;
    const hasAnswer = live.answerId && saved.some((m) => m.id === live.answerId);
    if (hasAnswer) {
      return saved.map((m) => (m.id === live.answerId && (live.phase !== "done" || m.status === "streaming") ? { ...m, content: live.content, status: live.phase === "error" ? "error" : "live" } : m));
    }
    return [...saved, { id: "q-live", role: "user" as const, content: live.question, status: "done" }, { id: "a-live", role: "assistant" as const, content: live.content, status: "live" }];
  }, [stored, live]);

  // Stay at the bottom while words arrive, unless the person has scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });

  const empty = rows.length === 0;
  const current = threads?.find((t) => t.id === threadId);

  return (
    <ChatActions.Provider value={actions}>
      <motion.div className="ll-ask-inner" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
        <header className="ll-ask-head">
          <button type="button" className={`ll-ask-icon${history ? " is-on" : ""}`} aria-label="Conversations" onClick={() => setHistory((x) => !x)}>
            <Icon name="clock" size={17} />
          </button>
          <div className="ll-ask-title">
            <strong>Ask Ledgerline</strong>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={current?.title ?? "new"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                {current?.title ?? "New conversation"}
              </motion.span>
            </AnimatePresence>
          </div>
          <button
            type="button"
            className="ll-ask-icon"
            aria-label="New conversation"
            onClick={() => {
              reset();
              setThreadId(null);
              setHistory(false);
              box.current?.focus();
            }}
          >
            <Icon name="plus" size={17} />
          </button>
          <button type="button" className="ll-ask-icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="ll-ask-body">
          <AnimatePresence>
            {history ? (
              <motion.nav
                key="history"
                className="ll-ask-history"
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <p className="ll-ask-history-head">Your conversations</p>
                {threads?.length ? (
                  <ul>
                    {threads.map((t) => (
                      <li key={t.id} className={t.id === threadId ? "is-on" : undefined}>
                        <button
                          type="button"
                          onClick={() => {
                            reset();
                            setThreadId(t.id);
                            setHistory(false);
                          }}
                        >
                          <span>{t.title}</span>
                          <small>{new Date(t.updatedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</small>
                        </button>
                        <button
                          type="button"
                          className="ll-ask-history-del"
                          aria-label={`Delete ${t.title}`}
                          onClick={() => {
                            if (t.id === threadId) {
                              reset();
                              setThreadId(null);
                            }
                            void removeThread({ threadId: t.id });
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ll-ask-history-empty">Nothing yet. Questions you ask are kept here, just for you.</p>
                )}
              </motion.nav>
            ) : null}
          </AnimatePresence>

          <div
            className="ll-ask-scroll"
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            }}
          >
            {empty ? (
              <Welcome onAsk={ask} suggestions={SUGGESTIONS[page.key]} />
            ) : (
              <div className="ll-ask-thread">
                {rows.map((m, i) =>
                  m.role === "user" ? (
                    <motion.div key={m.id} className="ll-ask-q" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.28, ease: EASE }}>
                      {m.content}
                    </motion.div>
                  ) : (
                    <motion.div key={m.id === "a-live" && live?.answerId ? live.answerId : m.id} className="ll-ask-a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      {m.status === "live" && live && i === rows.length - 1 && live.phase !== "writing" && !m.content ? (
                        <Reading steps={live.steps} phase={live.phase} />
                      ) : (
                        <>
                          {m.status === "live" && live?.steps.length ? <Reading steps={live.steps} phase={live.phase} /> : null}
                          <AnswerBody content={m.content} live={m.status === "live"} />
                        </>
                      )}
                      {m.status === "error" ? (
                        <p className="ll-ask-error">
                          <Icon name="warning" size={14} /> {live?.error ?? "That answer didn't finish."}
                        </p>
                      ) : null}
                    </motion.div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <form
          className={`ll-ask-composer${busy ? " is-busy" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <textarea
            ref={box}
            rows={1}
            value={text}
            maxLength={2000}
            placeholder={empty ? "Ask anything about your figures…" : "Ask a follow-up…"}
            aria-label="Ask a question"
            onChange={(e) => {
              setText(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(140, el.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(text);
              }
            }}
          />
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.button key="stop" type="button" className="ll-ask-send is-stop" aria-label="Stop" onClick={stop} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                <span />
              </motion.button>
            ) : (
              <motion.button key="send" type="submit" className="ll-ask-send" aria-label="Send" disabled={!text.trim()} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Icon name="arrow-up" size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </form>
        <p className="ll-ask-foot">Answers come from your books. Opinions are the assistant&apos;s own; check before you act.</p>
      </motion.div>
    </ChatActions.Provider>
  );
}

function Welcome({ onAsk, suggestions }: { onAsk: (q: string) => void; suggestions: string[] }) {
  return (
    <div className="ll-ask-welcome">
      <motion.div className="ll-ask-orb is-big" aria-hidden initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.1 }} />
      <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.16 }}>
        What would you like to know?
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.22 }}>
        Ask about your cash, costs, customers or plans. Answers use your own books and forecast.
      </motion.p>
      <div className="ll-ask-suggest">
        {suggestions.map((s, i) => (
          <motion.button
            key={s}
            type="button"
            onClick={() => onAsk(s)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.28 + i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            {s}
            <Icon name="arrow-right" size={14} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
