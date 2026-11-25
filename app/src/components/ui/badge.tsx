import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { LiveDot } from "./live-dot";

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
  | "live"
  | "flow"
  | "fundamentals";
// Soft tinted pills: tone colour as text, a faint wash of it behind.
const tones: Record<BadgeTone, string> = {
  neutral: "text-muted bg-surface-2 ring-line-strong",
  sealed: "text-sealed bg-sealed/10 ring-sealed/25",
  opened: "text-opened bg-opened/10 ring-opened/25",
  buy: "text-buy bg-buy/10 ring-buy/25",
  sell: "text-sell bg-sell/10 ring-sell/25",
  priority: "text-ink bg-priority/10 ring-priority/25",
  common: "text-common bg-common/10 ring-common/25",
  rare: "text-rare bg-rare/10 ring-rare/25",
  epic: "text-epic bg-epic/10 ring-epic/25",
  whale: "text-whale bg-whale/10 ring-whale/25",
  live: "text-buy bg-buy/10 ring-buy/25",
  flow: "text-sealed bg-sealed/10 ring-sealed/25",
  fundamentals: "text-opened bg-opened/10 ring-opened/25",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] leading-none font-bold tracking-[.08em] uppercase ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      {tone === "live" && <LiveDot />}
      {props.children}
    </span>
  );
}
