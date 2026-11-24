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
// Toy-box badges: a solid candy fill with an ink outline, white text.
const tones: Record<BadgeTone, string> = {
  neutral: "text-ink border-ink bg-surface-2",
  sealed: "text-white border-ink bg-sealed",
  opened: "text-white border-ink bg-opened",
  buy: "text-white border-ink bg-buy",
  sell: "text-white border-ink bg-sell",
  priority: "text-white border-ink bg-priority",
  common: "text-white border-ink bg-common",
  rare: "text-white border-ink bg-rare",
  epic: "text-white border-ink bg-epic",
  whale: "text-white border-ink bg-whale",
  flow: "text-white border-ink bg-sealed",
  fundamentals: "text-white border-ink bg-opened",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-2 px-2.5 py-1 text-[10px] leading-none font-bold tracking-[.08em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
