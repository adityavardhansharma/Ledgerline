"use client";

import { Button, Icon, IconButton, Input, SegmentedControl, Select, type IconName } from "@ledgerline/ui";
import { useState } from "react";
import { money, periodLabel } from "@/lib/format";

export const loaded = (salaryCents: number, count: number) => (salaryCents / 12) * 1.1115 * count;
export const ONE_OFF = { capex: "Equipment", income: "One-off income", expense: "One-off expense" } as const;
export const FINANCING = { loan: "Loan drawn", equity: "Equity raised", dividend: "Dividend paid" } as const;

export function Sections({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { id: string; label: string; count: number }[] }) {
  return (
    <div className="ll-drv-tabs" role="tablist" aria-label="Forecast sections">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={t.id === value ? "is-on" : undefined} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count ? <span>{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export interface PlanItem { id: string; icon: IconName; tone: string; title: string; meta: string; amount: number; note: string; own: boolean }

export function PlanList({ items, onRemove, form, readOnly, empty, total }: { items: PlanItem[]; onRemove: (id: string) => void; form: React.ReactNode; readOnly: boolean; empty: string; total?: string }) {
  return (
    <div className="ll-plan">
      {items.length ? (
        <ul className="ll-plan-list">
          {items.map((it) => (
            <li key={it.id} className="ll-plan-item">
              <span className={`ll-plan-icon is-${it.tone}`}><Icon name={it.icon} size={17} /></span>
              <div className="ll-plan-main">
                <div className="ll-plan-title">{it.title}</div>
                <div className={`ll-plan-amt-v ${it.amount < 0 ? "is-neg" : "is-pos"}`}>{it.amount < 0 ? "−" : "+"}{money(Math.abs(Math.round(it.amount)))}</div>
                <div className="ll-plan-meta">{it.meta}</div>
                <div className="ll-plan-amt-n">{it.note}</div>
              </div>
              {readOnly ? null : it.own ? (
                <IconButton icon="trash" label={`Remove ${it.title}`} size="sm" onClick={() => onRemove(it.id)} />
              ) : (
                <span className="ll-plan-inherited" title="Planned in the parent scenario">Inherited</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="ll-plan-empty">
          <Icon name="info" size={18} />
          <p>{empty}</p>
        </div>
      )}
      {total ? <div className="ll-plan-total">{total}</div> : null}
      {readOnly ? <p className="ll-plan-note">Branch the base case to plan changes.</p> : form}
    </div>
  );
}

function Composer({ add, title, summary, valid, onAdd, children }: { add: string; title: string; summary: React.ReactNode; valid: boolean; onAdd: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="ll-plan-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /> {add}
      </button>
    );
  }
  return (
    <form
      className="ll-plan-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onAdd();
        setOpen(false);
      }}
    >
      <div className="ll-plan-form-head">{title}</div>
      {children}
      <div className="ll-plan-summary">{summary}</div>
      <div className="ll-plan-form-foot">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" variant="primary" icon="check" disabled={!valid}>{add}</Button>
      </div>
    </form>
  );
}

function monthOptions(start: string) {
  const out = [];
  let [y, m] = start.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    const p = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ value: p, label: periodLabel(p) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

const digits = (v: string) => v.replace(/[^\d.]/g, "");

export function AddHire({ start, onAdd }: { start: string; onAdd: (h: { role: string; salaryCents: number; startPeriod: string; count: number }) => void }) {
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [period, setPeriod] = useState(start);
  const [count, setCount] = useState("1");
  const salaryCents = Math.round(Number(salary) * 100), n = Number(count);
  const valid = Boolean(role.trim()) && salaryCents > 0 && n >= 1;
  return (
    <Composer
      add="Add hire"
      title="New hire"
      valid={valid}
      onAdd={() => { onAdd({ role: role.trim(), salaryCents, startPeriod: period, count: n }); setRole(""); setSalary(""); setCount("1"); }}
      summary={
        salaryCents > 0 && n >= 1 ? (
          <>Adds <strong>{money(Math.round(loaded(salaryCents, n)))}</strong> a month from {periodLabel(period)}, including 11.15% employer PRSI.</>
        ) : (
          "Enter a salary to see the monthly cost."
        )
      }
    >
      <Input id="hire-role" label="Role" placeholder="e.g. Cabinet maker" value={role} onChange={(e) => setRole(e.target.value)} autoFocus />
      <div className="ll-plan-fields">
        <Input id="hire-salary" label="Annual salary" prefix="€" numeric placeholder="45000" value={salary} onChange={(e) => setSalary(digits(e.target.value))} />
        <Input id="hire-count" label="People" numeric value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Select id="hire-start" label="Start month" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
    </Composer>
  );
}

export function AddOneOff({ start, onAdd }: { start: string; onAdd: (o: { label: string; period: string; amountCents: number; kind: "capex" | "income" | "expense" }) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(start);
  const [kind, setKind] = useState<"capex" | "income" | "expense">("capex");
  const cents = Math.round(Number(amount) * 100);
  const when = periodLabel(period);
  return (
    <Composer
      add="Add one-off"
      title="New one-off"
      valid={Boolean(label.trim()) && cents > 0}
      onAdd={() => { onAdd({ label: label.trim(), period, amountCents: cents, kind }); setLabel(""); setAmount(""); }}
      summary={
        cents <= 0
          ? "Enter an amount to see its effect."
          : kind === "capex"
            ? <>Pays <strong>{money(cents)}</strong> in {when}; the cost reaches profit gradually as depreciation.</>
            : kind === "income"
              ? <>Adds <strong>{money(cents)}</strong> to cash and profit in {when}.</>
              : <>Takes <strong>{money(cents)}</strong> from cash and profit in {when}.</>
      }
    >
      <SegmentedControl label="Type" value={kind} onChange={(v) => setKind(v as typeof kind)} options={[{ value: "capex", label: "Equipment" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" }]} />
      <Input id="oneoff-label" label="What" placeholder={kind === "capex" ? "e.g. CNC router" : kind === "income" ? "e.g. Grant received" : "e.g. Website rebuild"} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      <div className="ll-plan-fields">
        <Input id="oneoff-amount" label="Amount" prefix="€" numeric placeholder="10000" value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
        <Select id="oneoff-period" label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
      </div>
    </Composer>
  );
}

export function AddFinancing({ start, onAdd }: { start: string; onAdd: (f: { period: string; amountCents: number; kind: "loan" | "equity" | "dividend" }) => void }) {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(start);
  const [kind, setKind] = useState<"loan" | "equity" | "dividend">("loan");
  const cents = Math.round(Number(amount) * 100);
  const when = periodLabel(period);
  return (
    <Composer
      add="Add financing"
      title="New financing"
      valid={cents > 0}
      onAdd={() => { onAdd({ period, amountCents: cents, kind }); setAmount(""); }}
      summary={
        cents <= 0
          ? "Enter an amount to see its effect."
          : kind === "loan"
            ? <>Adds <strong>{money(cents)}</strong> to cash in {when}, with interest charged from then on.</>
            : kind === "equity"
              ? <>Adds <strong>{money(cents)}</strong> to cash and equity in {when}.</>
              : <>Pays <strong>{money(cents)}</strong> to shareholders in {when}.</>
      }
    >
      <SegmentedControl label="Type" value={kind} onChange={(v) => setKind(v as typeof kind)} options={[{ value: "loan", label: "Loan" }, { value: "equity", label: "Equity" }, { value: "dividend", label: "Dividend" }]} />
      <div className="ll-plan-fields">
        <Input id="fin-amount" label="Amount" prefix="€" numeric placeholder="50000" value={amount} onChange={(e) => setAmount(digits(e.target.value))} autoFocus />
        <Select id="fin-period" label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
      </div>
    </Composer>
  );
}
