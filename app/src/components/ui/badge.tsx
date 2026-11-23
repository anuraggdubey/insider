import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "sealed"
  | "opened"
  | "buy"
  | "sell"
  | "priority"
  | "common"
  | "rare"
  | "epic"
  | "whale"
  | "flow"
  | "fundamentals";
const tones: Record<BadgeTone, string> = {
  neutral: "text-muted border-line-strong bg-surface-2",
  sealed: "text-sealed border-sealed/20 bg-sealed/10",
  opened: "text-opened border-opened/20 bg-opened/10",
  buy: "text-buy border-buy/20 bg-buy/10",
  sell: "text-sell border-sell/20 bg-sell/10",
  priority: "text-priority border-priority/20 bg-priority/10",
  common: "text-common border-common/20 bg-common/10",
  rare: "text-rare border-rare/20 bg-rare/10",
  epic: "text-epic border-epic/20 bg-epic/10",
  whale: "text-whale border-whale/20 bg-whale/10",
  flow: "text-sealed border-sealed/20 bg-sealed/10",
  fundamentals: "text-opened border-opened/20 bg-opened/10",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-1 font-mono text-[10px] leading-none tracking-[.1em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
