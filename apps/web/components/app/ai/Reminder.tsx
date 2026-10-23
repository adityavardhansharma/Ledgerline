"use client";

import { Amount, Button, Dialog, Icon } from "@ledgerline/ui";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AiButton, plainText, Thinking, useAi } from "./AiAction";

/**
 * A paragraph of the drafted email as text. Invoices are cited one after another with nothing between them, so each
 * cited figure that follows another (or follows a colon) starts its own line.
 */
function lines(paragraph: Parameters<typeof plainText>[0]) {
  let out = "";
  let lastWasFact = false;
  for (const part of paragraph) {
    if (typeof part === "string") {
      out += part;
      lastWasFact = false;
      continue;
    }
    if (lastWasFact || /:\s*$/.test(out)) out = `${out.trimEnd()}\n`;
    out += part.text;
    lastWasFact = true;
  }
  return out.trim();
}

/**
 * The customers who owe the most, each with a drafted payment reminder. Ledgerline never sends it: the person
 * copies it or opens it in their own email, and can edit it first.
 */
const DRAFTED_KEY = "ll-reminders-drafted";

/** Customers with a drafted reminder, remembered in this browser so the button can say so. */
function useDrafted() {
  const [drafted, setDrafted] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDrafted(JSON.parse(localStorage.getItem(DRAFTED_KEY) ?? "[]"));
    } catch {}
  }, []);
  const mark = (contact: string) =>
    setDrafted((was) => {
      const next = was.includes(contact) ? was : [...was, contact];
      try {
        localStorage.setItem(DRAFTED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [drafted, mark] as const;
}

export function OwedList({ top }: { top: { contact: string; value: number }[] }) {
  const draft = useAction(api.aiActions.reminder);
  const ai = useAi(draft);
  const [drafted, markDrafted] = useDrafted();
  const [contact, setContact] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  if (!top.length) return null;

  const open = async (name: string, fresh = false) => {
    setContact(name);
    setCopied(false);
    if (fresh) {
      setSubject("");
      setBody("");
    }
    const result = await ai.run({ contact: name, fresh });
    if (result) {
      setSubject(plainText(result.subject));
      setBody(result.body.map(lines).join("\n\n"));
      markDrafted(name);
    }
  };
  const close = () => {
    ai.close();
    setContact(null);
  };

  return (
    <>
      <ul className="ll-owed">
        {top.slice(0, 5).map((row) => {
          const done = drafted.includes(row.contact);
          return (
            <li key={row.contact}>
              <span className="ll-owed-who">
                <span className="ll-owed-name">{row.contact}</span>
                <Amount value={row.value / 100} />
              </span>
              {done ? (
                <button type="button" className="ll-owed-done" onClick={() => void open(row.contact)} title="Reminder drafted · Open it to copy, edit or draft a new one">
                  <Icon name="check" size={13} /> View reminder
                </button>
              ) : (
                <AiButton size="sm" onClick={() => void open(row.contact)} busy={ai.busy && contact === row.contact}>
                  Draft
                </AiButton>
              )}
            </li>
          );
        })}
      </ul>
      {ai.open && contact ? (
        <Dialog
          title={`Reminder to ${contact}`}
          onClose={close}
          footer={
            <>
              <Button icon="sparkle" disabled={ai.busy} onClick={() => void open(contact, true)}>
                New draft
              </Button>
              <span style={{ flex: 1 }} />
              <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
                <Button icon="external" disabled={!body}>Open in email</Button>
              </a>
              <Button
                variant="primary"
                icon={copied ? "check" : "copy"}
                disabled={!body}
                onClick={async () => {
                  await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </>
          }
        >
          {ai.error ? (
            <p className="ll-ai-error">{ai.error}</p>
          ) : ai.busy ? (
            <Thinking steps={["Reading their unpaid invoices", "Working out what's overdue", "Drafting the message"]} />
          ) : (
            <div className="ll-stack">
              <p className="ll-ai-muted">Drafted from their unpaid invoices. Edit anything before you send it yourself; Ledgerline never emails customers.</p>
              <label className="ll-field">
                <span className="ll-field-label">Subject</span>
                <input className="ll-mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label className="ll-field">
                <span className="ll-field-label">Message</span>
                <textarea className="ll-mail-body" rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
            </div>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
