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
  className,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  off: ReactNode;
  on: ReactNode;
  disabled?: boolean;
  className?: string;
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
        "border-line-strong bg-surface-2 relative inline-grid min-h-10 cursor-pointer grid-cols-2 items-center rounded-full border-2 p-1 text-center text-[11px] font-extrabold uppercase",
        disabled && "cursor-default opacity-45",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "seg-thumb absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform motion-reduce:transition-none",
          checked && "translate-x-full",
        )}
      />
      <span className={cn("relative px-3", !checked && "seg-on")}>{off}</span>
      <span className={cn("relative px-3", checked && "seg-on")}>{on}</span>
    </button>
  );
}
