"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/cn";

export function Num({
  value,
  kind = "chips",
  className,
}: {
  value: number;
  kind?: "chips" | "price" | "delta";
  className?: string;
}) {
  const number = kind === "price" ? value / 1_000_000 : value;
  return (
    <NumberFlow
      value={number}
      format={
        kind === "price"
          ? { minimumFractionDigits: 4, maximumFractionDigits: 4 }
          : kind === "delta"
            ? { signDisplay: "exceptZero", maximumFractionDigits: 2 }
            : { maximumFractionDigits: 0 }
      }
      className={cn(
        "font-mono tabular-nums",
        kind === "delta" && (value > 0 ? "text-buy" : value < 0 ? "text-sell" : "text-muted"),
        className,
      )}
    />
  );
}
