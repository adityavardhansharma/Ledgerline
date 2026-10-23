"use client";

import { Amount, Button, Dialog } from "@ledgerline/ui";
import { useAction } from "convex/react";
import { useState } from "react";
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
export function OwedList({ top }: { top: { contact: string; value: number }[] }) {
  const draft = useAction(api.aiActions.reminder);
  const ai = useAi(draft);
  const [contact, setContact] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  if (!top.length) return null;

  const open = async (name: string) => {
    setContact(name);
    setCopied(false);
    const result = await ai.run({ contact: name });
    if (result) {
      setSubject(plainText(result.subject));
      setBody(result.body.map(lines).join("\n\n"));
    }
  };
  const close = () => {
    ai.close();
    setContact(null);
  };

  return (
    <>
      <ul className="ll-owed">
        {top.slice(0, 5).map((row) => (
          <li key={row.contact}>
            <span className="ll-owed-name">{row.contact}</span>
            <Amount value={row.value / 100} />
            <AiButton size="sm" onClick={() => void open(row.contact)} busy={ai.busy && contact === row.contact}>
              Draft reminder
            </AiButton>
          </li>
        ))}
      </ul>
      {ai.open && contact ? (
        <Dialog
          title={`Reminder to ${contact}`}
          onClose={close}
          footer={
            <>
              <Button onClick={close}>Close</Button>
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
