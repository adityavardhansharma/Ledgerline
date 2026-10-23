"use client";

import { Badge, Banner, Button, Dialog, Icon, IconButton, SegmentedControl, Skeleton } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Citation, Commentary, Prose, Question, Risk, Section, Sections } from "@/convex/commentary";
import type { Id } from "@/convex/_generated/dataModel";

const TITLES: Record<Section, string> = {
  headline: "At a glance",
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

/** A server error in plain words: a ConvexError's own message, never "Server Error" or a stack trace. */
export const errorText = (err: unknown, fallback: string) => {
  if (err instanceof ConvexError) {
    if (typeof err.data === "string") return err.data;
    const message = (err.data as { message?: unknown } | null)?.message;
    return typeof message === "string" ? message : fallback;
  }
  if (!(err instanceof Error)) return fallback;
  const text = err.message.replace(/^[\s\S]*?(ConvexError|Uncaught Error|Error): /, "").replace(/\s+at [\s\S]*$/, "");
  return !text || /Server Error|Request ID/.test(text) ? fallback : text;
};

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
            <span>
              <T parts={p} set={set(i)} />
            </span>
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
        <span className="ll-bc-kicker">{commentary.status === "accepted" ? "Commentary" : "Draft commentary"}</span>
        <span className="ll-bc-meta">
          {commentary.status === "accepted" ? `Accepted by ${commentary.acceptedBy} · ` : ""}Every figure comes from the accounts; hover one for its source
        </span>
      </header>
      {ORDER.map((name, index) => {
        const isEditing = editing === name;
        const redrafting = busy === name;
        return (
          <section key={name} className={`ll-bc-section is-${name}${isEditing ? " is-editing" : ""}`}>
            <div className="ll-bc-section-head">
              {name === "headline" ? null : <span className="ll-bc-num">{String(index).padStart(2, "0")}</span>}
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

/** Who the draft is written for, how long it runs, and the draft button. Sits above the pack and never prints. */
export function CommentaryToolbar({
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
  const [tone, setTone] = useState(commentary?.tone ?? "board");
  const [length, setLength] = useState(commentary?.length ?? "standard");
  useEffect(() => {
    if (commentary) {
      setTone(commentary.tone);
      setLength(commentary.length);
    }
  }, [commentary?.tone, commentary?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="ll-studio no-print">
      <div className="ll-studio-intro">
        <span className="ll-studio-icon"><Icon name="sparkle" size={16} /></span>
        <div>
          <strong>Commentary</strong>
          <span>Drafted from every figure, the forecast and its scenarios. About half a minute.</span>
        </div>
      </div>
      <div className="ll-studio-options">
        <div className="ll-studio-field">
          <span>Written for</span>
          <SegmentedControl label="Written for" size="sm" value={tone} onChange={setTone} options={TONES} />
        </div>
        <div className="ll-studio-field">
          <span>Length</span>
          <SegmentedControl label="Length" size="sm" value={length} onChange={setLength} options={LENGTHS} />
        </div>
        {commentary ? (
          <Button variant="ghost" size="sm" icon="clock" onClick={onHistory}>
            Versions
          </Button>
        ) : null}
        <Button variant={commentary ? "secondary" : "primary"} size="sm" icon="sparkle" loading={busy} onClick={() => onDraft({ tone, length })}>
          {commentary ? "Redraft all" : "Draft commentary"}
        </Button>
      </div>
    </section>
  );
}

const PROMPTS = ["Contracts won or lost", "Hires and leavers", "Price changes", "One-off costs or income", "Big customers"];
const ago = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(ms).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
};

/**
 * Context only the team knows, for this month's draft. Saved as you leave the box; the next draft (or a redraft
 * from here) uses it to explain causes. Never printed, and never a source of figures.
 */
export function BoardNotes({ canRedraft, busy, onRedraft }: { canRedraft: boolean; busy: boolean; onRedraft: () => void }) {
  const notes = useQuery(api.commentary.notes, {});
  const saveNotes = useMutation(api.commentary.saveNotes);
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const box = useRef<HTMLTextAreaElement>(null);
  const value = text ?? notes?.text ?? "";
  const dirty = text !== null && text !== (notes?.text ?? "");

  const persist = async () => {
    if (!dirty || text === null) return true;
    setState("saving");
    try {
      await saveNotes({ text });
      setState("saved");
      return true;
    } catch {
      setState("error");
      return false;
    }
  };
  const add = (prompt: string) => {
    const next = `${value.trim() ? `${value.replace(/\s+$/, "")}\n` : ""}${prompt}: `;
    setText(next);
    setState("idle");
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(next.length, next.length);
    });
  };

  return (
    <section className="ll-notes no-print">
      <header className="ll-notes-head">
        <span className="ll-notes-icon"><Icon name="edit" size={16} /></span>
        <div>
          <h3>Notes for this month&apos;s commentary</h3>
          <p>What the figures can&apos;t say on their own. The draft uses these to explain why things moved; they never print and are never quoted as figures.</p>
        </div>
      </header>
      <div className="ll-notes-prompts">
        {PROMPTS.map((p) => (
          <button key={p} type="button" onClick={() => add(p)}>
            <Icon name="plus" size={12} /> {p}
          </button>
        ))}
      </div>
      <textarea
        ref={box}
        id="board-notes"
        aria-label="Notes for this month's commentary"
        className="ll-notes-box"
        rows={5}
        placeholder={"Won the Seaview Hotel refurbishment.\nGlenmore phase two starts in November.\nPrices rose from March."}
        value={value}
        maxLength={4000}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        onBlur={() => void persist()}
      />
      <footer className="ll-notes-foot">
        <span className={`ll-notes-state is-${dirty && state === "idle" ? "dirty" : state}`}>
          {state === "saving"
            ? "Saving…"
            : state === "error"
              ? "Couldn't save. Try again."
              : dirty
                ? "Unsaved changes"
                : notes?.updatedBy && notes.updatedAt
                  ? `Saved · ${notes.updatedBy}, ${ago(notes.updatedAt)}`
                  : "Notes save as you click away"}
        </span>
        <span className="ll-notes-count">{value.length.toLocaleString("en-IE")} / 4,000</span>
        {canRedraft ? (
          <Button size="sm" icon="refresh" loading={busy} onClick={async () => { if (await persist()) onRedraft(); }}>
            Redraft with these notes
          </Button>
        ) : null}
      </footer>
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
                <span className="ll-ver-text">
                  <strong>{when(row.createdAt)}</strong>
                  <small>
                    {row.editedBy ? `Edited by ${row.editedBy}` : row.createdBy ? `Drafted by ${row.createdBy}` : "Drafted"} · {TONES.find((t) => t.value === row.tone)?.label ?? "Board"}, {row.length}
                  </small>
                </span>
                <span className="ll-ver-tags">
                  {row.id === currentId ? <Badge tone="brand">Current</Badge> : null}
                  {row.status === "accepted" ? <Badge tone="positive" icon="check">Accepted</Badge> : null}
                </span>
                <Icon name="chevron-right" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
