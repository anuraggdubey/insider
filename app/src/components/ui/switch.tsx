"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  label,
  off,
  on,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  off: ReactNode;
  on: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "border-line-strong bg-surface-2 relative inline-grid min-h-10 grid-cols-2 items-center rounded-full border p-1 font-mono text-[10px] font-bold uppercase",
        disabled && "opacity-45",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-surface border-line-strong absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full border transition-transform motion-reduce:transition-none",
          checked && "translate-x-full",
        )}
      />
      <span className="relative px-3">{off}</span>
      <span className="relative px-3">{on}</span>
    </button>
  );
}
