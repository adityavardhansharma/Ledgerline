"use client";

import { Button, Dialog, Input } from "@ledgerline/ui";
import { useMutation } from "convex/react";
import { useState } from "react";
import { errorText } from "@/components/app/BoardCommentary";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function BranchDialog({ fromId, fromName, onClose, onCreated }: { fromId: Id<"scenarios">; fromName: string; onClose: () => void; onCreated: (id: Id<"scenarios">) => void }) {
  const branch = useMutation(api.scenarios.branch);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await branch({ fromId, name }));
    } catch (err) {
      setError(errorText(err, "Couldn't branch the scenario."));
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={`Branch ${fromName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="branch" loading={busy} disabled={!name.trim()} onClick={submit}>
            Branch scenario
          </Button>
        </>
      }
    >
      <p>The new scenario starts identical to {fromName}. Change anything in it without touching the original.</p>
      <Input
        id="scenario-name"
        label="Scenario name"
        placeholder="e.g. Hire two engineers in January"
        value={name}
        error={error ?? undefined}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) void submit();
        }}
      />
    </Dialog>
  );
}
