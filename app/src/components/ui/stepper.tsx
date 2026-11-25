"use client";

import { useState } from "react";
import { Button } from "./button";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 50,
  presets = [250, 500, 1000, 2000],
  label = "Size in units",
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: number[];
  label?: string;
  id?: string;
}) {
  const [input, setInput] = useState<string | null>(null);
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={
            label === "Size in units" ? "Decrease size" : `Decrease ${label.toLowerCase()}`
          }
          onClick={() => set(value - step)}
          disabled={value <= min}
        >
          −
        </Button>
        <input
          aria-label={label}
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={input ?? value}
          onFocus={() => setInput(String(value))}
          onBlur={() => setInput(null)}
          onChange={(event) => {
            setInput(event.target.value);
            if (event.target.value !== "") set(Number(event.target.value));
          }}
          className="border-line-strong bg-surface-2 min-w-0 flex-1 rounded-xl border-2 px-3 py-1.5 text-center font-mono text-lg font-bold tabular-nums"
        />
        <Button
          variant="outline"
          size="sm"
          aria-label={
            label === "Size in units" ? "Increase size" : `Increase ${label.toLowerCase()}`
          }
          onClick={() => set(value + step)}
          disabled={value >= max}
        >
          +
        </Button>
      </div>
      <div className="stepper-presets grid grid-cols-4 gap-2">
        {presets
          .filter((preset) => preset >= min && preset <= max)
          .map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              size="sm"
              onClick={() => set(preset)}
              aria-pressed={value === preset}
            >
              {preset}
            </Button>
          ))}
      </div>
    </div>
  );
}
