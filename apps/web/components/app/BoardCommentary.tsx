"use client";

import { Badge, Banner, Button, Dialog, Icon, IconButton, SegmentedControl, Skeleton } from "@ledgerline/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Citation, Commentary, Prose, Question, Risk, Section, Sections } from "@/convex/commentary";
import type { Id } from "@/convex/_generated/dataModel";

const TITLES: Record<Section, string> = {
  headline: "Headline",
  performance: "Performance",
  cash: "Cash and working capital",
  outlook: "Outlook",
  risks: "Risks and watch list",
  decisions: "Decisions for the board",
  questions: "Questions the board may ask",
};
const ORDER = Object.keys(TITLES) as Section[];
const LEVEL = { red: "Act now", amber: "Watch", green: "Healthy" } as const;
const TONES = [
  { value: "board", label: "Board" },
  { value: "investor", label: "Investors" },
  { value: "brief", label: "Brief" },
];
const LENGTHS = [
  { value: "short", label: "Short" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
];

export const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message.replace(/^[\s\S]*?(ConvexError|Uncaught Error|Error): /, "").replace(/\s+at [\s\S]*$/, "") || fallback : fallback;

const isCitation = (part: string | Citation): part is Citation => typeof part !== "string";
const proseText = (parts: Prose) => parts.map((p) => (isCitation(p) ? p.text : p)).join("");
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Words with cited figures. Each figure shows where it came from on hover. */
export function Text({ parts }: { parts: Prose }) {
  return (
    <>
      {parts.map((part, i) =>
        isCitation(part) ? (
          <button key={i} type="button" className="ll-cite" title={part.source}>
            {part.text}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Editable words; figures stay as locked chips that can be removed but not changed. */
function EditText({ parts, onChange }: { parts: Prose; onChange: (next: Prose) => void }) {
  return (
    <span className="ll-bc-edit">
      {parts.map((part, i) =>
        isCitation(part) ? (
          <span key={i} className="ll-cite is-locked" contentEditable={false} title={`${part.source} · figures come from the accounts`}>
            {part.text}
            <button type="button" aria-label={`Remove ${part.text}`} onClick={() => onChange(parts.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ) : (
          <span
            key={i}
            contentEditable
            suppressContentEditableWarning
            className="ll-bc-words"
            onBlur={(e) => {
              const next = [...parts];
              next[i] = e.currentTarget.textContent ?? "";
              onChange(next);
            }}
          >
            {part}
          </span>
        ),
      )}
    </span>
  );
}

function SectionBody({ name, value, editing, onChange }: { name: Section; value: unknown; editing: boolean; onChange: (next: unknown) => void }) {
  const T = ({ parts, set }: { parts: Prose; set: (p: Prose) => void }) => (editing ? <EditText parts={parts} onChange={set} /> : <Text parts={parts} />);
  if (name === "risks") {
    const risks = (value as Risk[]) ?? [];
    if (!risks.length) return <p className="ll-bc-empty">No risks flagged.</p>;
    return (
      <ul className="ll-bc-risks">
        {risks.map((r, i) => (
          <li key={i} className={`is-${r.level}`}>
            <span className="ll-bc-level">{LEVEL[r.level]}</span>
            <div>
              {editing ? (
                <input
                  className="ll-bc-title-input"
                  defaultValue={r.title}
                  aria-label="Risk title"
                  onBlur={(e) => {
                    const next = clone(risks);
                    next[i].title = e.currentTarget.value;
                    onChange(next);
                  }}
                />
              ) : (
                <strong>{r.title}</strong>
              )}{" "}
              <T
                parts={r.detail}
                set={(p) => {
                  const next = clone(risks);
                  next[i].detail = p;
                  onChange(next);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (name === "questions") {
    const questions = (value as Question[]) ?? [];
    if (!questions.length) return <p className="ll-bc-empty">No questions suggested.</p>;
    return (
      <dl className="ll-bc-qa">
        {questions.map((q, i) => (
          <div key={i}>
            <dt>
              <T parts={q.question} set={(p) => { const next = clone(questions); next[i].question = p; onChange(next); }} />
            </dt>
            <dd>
              <T parts={q.answer} set={(p) => { const next = clone(questions); next[i].answer = p; onChange(next); }} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const items = (value as Prose[]) ?? [];
  const set = (i: number) => (p: Prose) => {
    const next = clone(items);
    next[i] = p;
    onChange(next);
  };
  if (name === "headline") {
    return (
      <ul className="ll-bc-headline">
        {items.map((p, i) => (
          <li key={i}>
            <T parts={p} set={set(i)} />
          </li>
        ))}
      </ul>
    );
  }
  if (name === "decisions") {
    if (!items.length) return <p className="ll-bc-empty">Nothing needs the board&apos;s decision this month.</p>;
    return (
      <ol className="ll-bc-decisions">
        {items.map((p, i) => (
          <li key={i}>
            <T parts={p} set={set(i)} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="ll-bc-prose">
      {items.map((p, i) => (
        <p key={i}>
          <T parts={p} set={set(i)} />
        </p>
      ))}
    </div>
  );
}

/** The board pack's commentary, section by section, with per-section redraft and edit while it's a draft. */
export function BoardCommentary({ commentary, busy, onRedraft }: { commentary: Commentary; busy: Section | "all" | null; onRedraft: (s: Section) => void }) {
  const editSection = useMutation(api.commentary.editSection);
  const [editing, setEditing] = useState<Section | null>(null);
  const [value, setValue] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [figures, setFigures] = useState(false);
  const sections = commentary.sections as Sections;
  const draft = commentary.status === "draft";
  const cited = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      const c = x as Citation;
      if (typeof c.text === "string" && typeof c.source === "string") cited.add(c.fact ?? c.source);
      else Object.values(x).forEach(walk);
    }
  };
  walk(sections);
  const used = commentary.facts.filter((f) => cited.has(f.id));

  const start = (name: Section) => {
    setError(null);
    setEditing(name);
    setValue(clone(sections[name] ?? []));
  };
  const save = async () => {
    if (!editing) return;
    // Let the last edited span's blur land first.
    (document.activeElement as HTMLElement | null)?.blur();
    await new Promise((r) => setTimeout(r, 0));
    setSaving(true);
    setError(null);
    try {
      await editSection({ id: commentary.id as Id<"commentaries">, section: editing, value: valueRef.current });
      setEditing(null);
    } catch (err) {
      setError(errorText(err, "Couldn't save the edit."));
    } finally {
      setSaving(false);
    }
  };
  const valueRef = useRef<unknown>(null);
  valueRef.current = value;

  return (
    <article className="ll-bc">
      <header className="ll-bc-head">
        <span className="ll-comm-tag">
          <Icon name="sparkle" size={14} /> {commentary.status === "accepted" ? "Commentary" : "Draft commentary"}
        </span>
        <span className="ll-comm-meta">
          {commentary.status === "accepted" ? `Accepted by ${commentary.acceptedBy}` : "Every figure is a citation of the accounts · hover one to see its source"}
        </span>
      </header>
      {ORDER.map((name) => {
        const isEditing = editing === name;
        const redrafting = busy === name;
        return (
          <section key={name} className={`ll-bc-section is-${name}${isEditing ? " is-editing" : ""}`}>
            <div className="ll-bc-section-head">
              <h3>{TITLES[name]}</h3>
              {draft ? (
                <span className="ll-bc-tools no-print">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      <Button size="sm" variant="primary" icon="check" loading={saving} onClick={save}>Save</Button>
                    </>
                  ) : (
                    <>
                      <IconButton icon="edit" label={`Edit ${TITLES[name]}`} size="sm" disabled={Boolean(busy)} onClick={() => start(name)} />
                      <IconButton icon="refresh" label={`Redraft ${TITLES[name]}`} size="sm" disabled={Boolean(busy) || Boolean(editing)} onClick={() => onRedraft(name)} />
                    </>
                  )}
                </span>
              ) : null}
            </div>
            {redrafting ? (
              <Skeleton lines={3} />
            ) : (
              <SectionBody name={name} value={isEditing ? value : sections[name]} editing={isEditing} onChange={setValue} />
            )}
            {isEditing ? (
              <p className="ll-bc-hint no-print">Change the wording freely. Figures are locked to the accounts: remove one with ×, but numbers can&apos;t be typed in.</p>
            ) : null}
            {isEditing && error ? <Banner tone="negative">{error}</Banner> : null}
          </section>
        );
      })}
      <footer className="ll-bc-foot no-print">
        <button type="button" className="ll-bc-figures-toggle" onClick={() => setFigures((x) => !x)} aria-expanded={figures}>
          <Icon name={figures ? "chevron-up" : "chevron-down"} size={14} /> Every figure cited ({used.length})
        </button>
        {figures ? (
          <table className="ll-bc-figures">
            <tbody>
              {used.map((f) => (
                <tr key={f.id}>
                  <td>{f.label}</td>
                  <td className="ll-mono">{f.value}</td>
                  <td>{f.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </footer>
    </article>
  );
}

/** Notes, tone and length for the draft, and the draft button. Sits above the pack and never prints. */
export function CommentaryStudio({
  commentary,
  busy,
  onDraft,
  onHistory,
}: {
  commentary: Commentary | null | undefined;
  busy: boolean;
  onDraft: (opts: { tone: string; length: string }) => void;
  onHistory: () => void;
}) {
  const notes = useQuery(api.commentary.notes, {});
  const saveNotes = useMutation(api.commentary.saveNotes);
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tone, setTone] = useState(commentary?.tone ?? "board");
  const [length, setLength] = useState(commentary?.length ?? "standard");
  useEffect(() => {
    if (commentary) {
      setTone(commentary.tone);
      setLength(commentary.length);
    }
  }, [commentary?.tone, commentary?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = text ?? notes?.text ?? "";

  const persist = async () => {
    if (text === null || text === notes?.text) return;
    setState("saving");
    try {
      await saveNotes({ text });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  return (
    <section className="ll-studio no-print">
      <div className="ll-studio-notes">
        <label htmlFor="board-notes" className="ll-field-label">
          Notes for this month
        </label>
        <p className="ll-field-hint">What the figures can&apos;t say: contracts won or lost, hires, price changes, one-offs. The draft uses them to explain causes.</p>
        <textarea
          id="board-notes"
          className="ll-textarea"
          rows={4}
          placeholder="e.g. Won the Seaview Hotel refurbishment. Glenmore phase two starts in November. Price rise from March."
          value={value}
          maxLength={4000}
          onChange={(e) => {
            setText(e.target.value);
            setState("idle");
          }}
          onBlur={persist}
        />
        <span className="ll-studio-saved">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn't save" : notes?.updatedBy ? `Last edited by ${notes.updatedBy}` : ""}
        </span>
      </div>
      <div className="ll-studio-options">
        <div className="ll-field">
          <span className="ll-field-label">Written for</span>
          <SegmentedControl label="Written for" size="sm" value={tone} onChange={setTone} options={TONES} />
        </div>
        <div className="ll-field">
          <span className="ll-field-label">Length</span>
          <SegmentedControl label="Length" size="sm" value={length} onChange={setLength} options={LENGTHS} />
        </div>
        <div className="ll-studio-actions">
          <Button
            variant="primary"
            icon="sparkle"
            loading={busy}
            onClick={async () => {
              await persist();
              onDraft({ tone, length });
            }}
          >
            {commentary ? "Redraft all" : "Draft commentary"}
          </Button>
          {commentary ? (
            <Button variant="ghost" icon="clock" onClick={onHistory}>
              Versions
            </Button>
          ) : null}
        </div>
        <p className="ll-field-hint">Drafting reads every figure, the forecast and its scenarios, and takes about half a minute.</p>
      </div>
    </section>
  );
}

const when = (ms: number) => new Date(ms).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Earlier drafts of this month's commentary; any can become the current draft again. */
export function VersionHistory({ currentId, onClose }: { currentId: string | null; onClose: () => void }) {
  const versions = useQuery(api.commentary.history, {});
  const restore = useMutation(api.commentary.restore);
  const [viewing, setViewing] = useState<Commentary | null>(null);
  return (
    <Dialog title={viewing ? `Version from ${when(viewing.createdAt)}` : "Versions this month"} onClose={viewing ? () => setViewing(null) : onClose} footer={
      viewing ? (
        <>
          <Button onClick={() => setViewing(null)}>Back</Button>
          {viewing.id !== currentId ? (
            <Button variant="primary" icon="refresh" onClick={async () => { await restore({ id: viewing.id as Id<"commentaries"> }); onClose(); }}>
              Make this the draft
            </Button>
          ) : null}
        </>
      ) : (
        <Button onClick={onClose}>Close</Button>
      )
    }>
      {viewing ? (
        <div className="ll-bc-preview">
          {viewing.sections ? (
            (["headline", "performance", "cash", "outlook"] as const).map((k) => (
              <div key={k}>
                <h4>{TITLES[k]}</h4>
                {(viewing.sections?.[k] ?? []).map((p, i) => <p key={i}>{proseText(p)}</p>)}
              </div>
            ))
          ) : (
            (viewing.paragraphs ?? []).map((p, i) => <p key={i}>{proseText(p)}</p>)
          )}
        </div>
      ) : versions === undefined ? (
        <Skeleton lines={4} />
      ) : (
        <ul className="ll-versions">
          {versions.map((row) => (
            <li key={row.id}>
              <button type="button" onClick={() => setViewing(row)}>
                <span>
                  <strong>{when(row.createdAt)}</strong>
                  <small>
                    {row.editedBy ? `Edited by ${row.editedBy}` : row.createdBy ? `Drafted by ${row.createdBy}` : "Drafted"} · {TONES.find((t) => t.value === row.tone)?.label ?? "Board"}, {row.length}
                  </small>
                </span>
                {row.id === currentId ? <Badge tone="brand">Current</Badge> : null}
                {row.status === "accepted" ? <Badge tone="positive" icon="check">Accepted</Badge> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

const SUGGESTIONS = ["Why did cash move the way it did?", "Which customers matter most right now?", "Can we afford another hire?", "What should worry us about next quarter?"];

/** Ask about this month's figures. Answers cite the same facts as the commentary. */
export function AskFigures() {
  const ask = useAction(api.commentary.ask);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<{ question: string; answer: Prose[] | null; error?: string }[]>([]);
  const busy = turns.some((t) => t.answer === null && !t.error);
  const end = useRef<HTMLDivElement>(null);

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    const history = turns.filter((t) => t.answer).map((t) => ({ question: t.question, answer: (t.answer ?? []).map(proseText).join("\n") }));
    setTurns((all) => [...all, { question: text, answer: null }]);
    try {
      const result = await ask({ question: text, history });
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, answer: result.answer } : t)));
    } catch (err) {
      setTurns((all) => all.map((t, i) => (i === all.length - 1 ? { ...t, error: errorText(err, "Couldn't answer that.") } : t)));
    }
    setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  return (
    <section className="ll-ask no-print">
      <div className="ll-ask-head">
        <span className="ll-ask-icon"><Icon name="sparkle" size={16} /></span>
        <div>
          <h3>Ask about these figures</h3>
          <p>Answers come from this month&apos;s accounts, forecast and notes, and cite every figure.</p>
        </div>
      </div>
      {turns.length ? (
        <div className="ll-ask-thread">
          {turns.map((t, i) => (
            <div key={i} className="ll-ask-turn">
              <p className="ll-ask-q">{t.question}</p>
              {t.error ? (
                <p className="ll-ask-error">{t.error}</p>
              ) : t.answer === null ? (
                <Skeleton lines={2} />
              ) : (
                <div className="ll-ask-a">
                  {t.answer.map((p, j) => (
                    <p key={j}><Text parts={p} /></p>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
      ) : (
        <div className="ll-ask-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="ll-ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(question);
        }}
      >
        <input className="ll-ask-input" value={question} maxLength={500} placeholder="e.g. Why is gross margin lower than in the spring?" onChange={(e) => setQuestion(e.target.value)} aria-label="Question about the figures" />
        <Button type="submit" variant="primary" icon="arrow-right" disabled={!question.trim() || busy} loading={busy}>
          Ask
        </Button>
      </form>
    </section>
  );
}
