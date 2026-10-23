"use client";

import { useEffect, useState } from "react";

/**
 * One forecast driver: its name and value on a line, a slim slider beneath, and, when it differs from the
 * scenario it was branched from, what it was and a way back. The value reads as text and edits in place.
 */
export function DriverField({ id, label, unit, min, max, step, value, parent, help, readOnly, onChange, onReset }: { id: string; label: string; unit: string; min: number; max: number; step: number; value: number; parent?: number; help: string; readOnly?: boolean; onChange: (v: number) => void; onReset?: () => void }) {
  const [current, setCurrent] = useState(value);
  useEffect(() => setCurrent(value), [value]);
  const set = (v: number) => {
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(max, Math.max(min, v));
    setCurrent(clamped);
    onChange(clamped);
  };
  const changed = parent !== undefined && Math.abs(parent - current) > step / 2;
  const fill = ((current - min) / (max - min)) * 100;
  const shown = (v: number) => `${Number(v.toFixed(2))}${unit === "%" ? "%" : ` ${unit}`}`;
  return (
    <div className={`ll-drv${changed ? " is-changed" : ""}`}>
      <div className="ll-drv-top">
        <label htmlFor={id}>{label}</label>
        <span className="ll-drv-value">
          <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={current} disabled={readOnly} onChange={(e) => set(Number(e.target.value))} />
          <span>{unit}</span>
        </span>
      </div>
      <input type="range" className="ll-drv-range" aria-label={label} min={min} max={max} step={step} value={current} disabled={readOnly} style={{ "--fill": `${fill}%` } as React.CSSProperties} onChange={(e) => set(Number(e.target.value))} />
      <div className="ll-drv-foot">
        {changed ? (
          <>
            <span className="ll-drv-was">Was {shown(parent!)}</span>
            {onReset && !readOnly ? (
              <button type="button" onClick={onReset}>
                Reset
              </button>
            ) : null}
          </>
        ) : (
          <span>{help}</span>
        )}
      </div>
    </div>
  );
}
