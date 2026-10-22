"use client";

import { Icon } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NAV_ITEMS, ROUTES } from "@/lib/nav";
import { ChatActions } from "./library";
import { AnswerBody, Reading } from "./Message";
import { useChatStream } from "./useChatStream";

// A long, soft ease-out to open (fast start, gentle landing) and a short ease-in to close.
const OPEN = { duration: 0.42, ease: [0.16, 1, 0.3, 1] } as const;
const CLOSE = { duration: 0.2, ease: [0.4, 0, 1, 1] } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

type Suggestion = { text: string; topic: string; icon: Parameters<typeof Icon>[0]["name"] };
const S = (text: string, topic: string, icon: Suggestion["icon"]): Suggestion => ({ text, topic, icon });
const SUGGESTIONS: Record<string, Suggestion[]> = {
  overview: [S("How is cash looking?", "Cash", "bank"), S("What changed most this month?", "This month", "trend-up"), S("Who owes us the most?", "Customers", "invoice"), S("Are we doing better than last year?", "Year on year", "compare")],
  pnl: [S("Where do our costs go?", "Costs", "statement"), S("Why did revenue move this month?", "Revenue", "trend-up"), S("Show gross margin over the year", "Margin", "percent"), S("Which costs are growing fastest?", "Costs", "trend-down")],
  forecast: [S("When is cash lowest, and why?", "Forecast", "forecast"), S("Is the base case realistic?", "Assumptions", "settings"), S("Compare my scenarios", "Scenarios", "branch"), S("What would another hire do to cash?", "Hiring", "hire")],
  default: [S("How is the business doing?", "Overview", "overview"), S("How is cash looking?", "Cash", "bank"), S("Where do our costs go?", "Costs", "statement"), S("Who are our biggest customers?", "Customers", "team")],
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
  const [shortcut, setShortcut] = useState("Ctrl J");
  const reduce = useReducedMotion();
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘J");
  }, []);

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
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className="ll-ask-scrim no-print"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      {/* The panel rises from where the pill sits; the pill steps aside. Nothing stretches, so text never warps. */}
      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            className="ll-ask-panel no-print"
            style={{ transformOrigin: "50% 100%" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0.15 } : OPEN }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 18, scale: 0.98, transition: CLOSE }}
            role="dialog"
            aria-label="Ask Ledgerline"
          >
            <Panel onClose={() => setOpen(false)} />
          </motion.section>
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
            onClick={() => setOpen(true)}
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
      <motion.div className="ll-ask-inner" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}>
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
              <motion.div key="history-scrim" className="ll-ask-history-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setHistory(false)} />
            ) : null}
            {history ? (
              <motion.nav
                key="history"
                className="ll-ask-history"
                aria-label="Your conversations"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="ll-ask-history-top">
                  <p>Conversations</p>
                  <button
                    type="button"
                    className="ll-ask-history-new"
                    onClick={() => {
                      reset();
                      setThreadId(null);
                      setHistory(false);
                      box.current?.focus();
                    }}
                  >
                    <Icon name="plus" size={14} /> New
                  </button>
                </div>
                {threads?.length ? (
                  groupThreads(threads).map((group) => (
                    <section key={group.label} className="ll-ask-history-group">
                      <h4>{group.label}</h4>
                      <ul>
                        {group.items.map((t, i) => (
                          <motion.li
                            key={t.id}
                            className={t.id === threadId ? "is-on" : undefined}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + i * 0.03, duration: 0.25, ease: EASE }}
                          >
                            <button
                              type="button"
                              className="ll-ask-history-item"
                              onClick={() => {
                                reset();
                                setThreadId(t.id);
                                setHistory(false);
                              }}
                            >
                              <span className="ll-ask-history-icon" aria-hidden>
                                <Icon name={t.id === threadId ? "sparkle" : "statement"} size={14} />
                              </span>
                              <span className="ll-ask-history-text">
                                <span>{t.title}</span>
                                <small>{when(t.updatedAt)}</small>
                              </span>
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
                          </motion.li>
                        ))}
                      </ul>
                    </section>
                  ))
                ) : (
                  <div className="ll-ask-history-empty">
                    <span className="ll-ask-history-icon" aria-hidden><Icon name="statement" size={16} /></span>
                    <p>No conversations yet. Questions you ask are kept here, just for you.</p>
                  </div>
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

const DAY = 86_400_000;
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
function groupThreads<T extends { updatedAt: number }>(threads: T[]) {
  const today = startOfDay(Date.now());
  const groups: { label: string; items: T[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const t of threads) {
    const day = startOfDay(t.updatedAt);
    groups[day >= today ? 0 : day >= today - DAY ? 1 : day >= today - 6 * DAY ? 2 : 3].items.push(t);
  }
  return groups.filter((g) => g.items.length);
}
const when = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (startOfDay(ms) === startOfDay(Date.now())) return new Date(ms).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  return new Date(ms).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
};

function Welcome({ onAsk, suggestions }: { onAsk: (q: string) => void; suggestions: Suggestion[] }) {
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
            key={s.text}
            type="button"
            onClick={() => onAsk(s.text)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.28 + i * 0.05 }}
          >
            <span className="ll-ask-suggest-icon"><Icon name={s.icon} size={16} /></span>
            <span className="ll-ask-suggest-text">
              <small>{s.topic}</small>
              {s.text}
            </span>
            <span className="ll-ask-suggest-go" aria-hidden><Icon name="arrow-right" size={14} /></span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
