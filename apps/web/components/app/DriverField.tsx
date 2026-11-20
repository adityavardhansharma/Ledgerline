"use client";

import { Input } from "@ui-sdk/react/input";
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
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
          <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={String(current)} disabled={readOnly} onChange={(e) => set(Number(e.target.value))} />
          <span>{unit}</span>
        </span>
      </div>
      <Slider value={current} min={min} max={max} step={step} disabled={readOnly} format={(v) => shown(v)} onValueChange={(v) => set(v as number)}>
        <SliderControl className="ll-drv-range" style={{ "--fill": `${fill}%` } as React.CSSProperties}>
          <SliderTrack className="ll-drv-track">
            <SliderThumb className="ll-drv-thumb" aria-label={`Adjust ${label}`} />
          </SliderTrack>
        </SliderControl>
      </Slider>
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
