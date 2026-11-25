"use client";

import type { TableView } from "@insider/sdk";
import { Bot, Cpu, UserRound } from "lucide-react";
import Link from "next/link";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

// Each kind of player gets its own colour so the table reads at a glance.
const kindTone: Record<string, string> = {
  bot: "bg-[#1565ff] text-white",
  ai: "bg-[#7c3aed] text-white",
  human: "bg-[#0b8f55] text-white",
};

export function SeatRail({ view }: { view: TableView }) {
  return (
    <Panel
      title="Players"
      action={
        <span className="micro-label">
          {view.seats.filter((seat) => !seat.isFree).length}/{view.seats.length} seated
        </span>
      }
      className="min-[1440px]:flex min-[1440px]:h-full min-[1440px]:min-h-0 min-[1440px]:flex-col"
    >
      <div className="divide-line divide-y min-[1440px]:min-h-0 min-[1440px]:flex-1 min-[1440px]:overflow-y-auto">
        {view.seats.map((seat) => {
          const age = seat.lastSend ? view.tick - seat.lastSend.tick : -1;
          const pulse = (view.phase === "live" || view.phase === "closing") && age >= 0 && age <= 2;
          const priority = pulse && seat.lastSend?.lane === 1;
          const Icon = seat.kind === "bot" ? Bot : seat.kind === "ai" ? Cpu : UserRound;
          return (
            <div
              key={seat.index}
              className={cn(
                "flex min-h-[44px] items-center gap-2.5 px-3 py-1",
                seat.isMe && "bg-you/15 shadow-[inset_4px_0_0_var(--color-you)]",
              )}
            >
              <div
                key={`${seat.index}-${pulse ? seat.lastSend?.tick : "idle"}`}
                className={cn(
                  "flex size-9 shrink-0 flex-col overflow-hidden rounded-full border-2 border-[#0f1f5c]",
                  seat.isFree && !seat.isMe && "opacity-45",
                  pulse && (priority ? "seat-token-priority" : "seat-token-standard"),
                )}
              >
                <div
                  className={cn(
                    "grid h-1/2 place-items-center",
                    seat.isMe ? "bg-you text-white" : kindTone[seat.kind],
                    priority && "bg-signal !text-[#0f1f5c]",
                  )}
                >
                  <Icon aria-hidden className="size-3" />
                </div>
                <div className="grid h-1/2 place-items-center border-t-2 border-[#0f1f5c] bg-white font-mono text-[8px] font-bold text-[#0f1f5c]">
                  {String(seat.index + 1).padStart(2, "0")}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate text-[13px] font-extrabold",
                    seat.liquidated && "line-through",
                  )}
                >
                  {seat.isFree ? "Open seat" : seat.name}
                  {seat.isMe && (
                    <span className="bg-you ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black text-[var(--color-you-ink)]">
                      YOU
                    </span>
                  )}
                </div>
                {seat.isFree && seat.kind === "human" ? (
                  <Link
                    href="#join-seat"
                    className="text-brand text-[11px] font-extrabold underline-offset-4 hover:underline"
                  >
                    + JOIN
                  </Link>
                ) : (
                  <div className="text-muted flex gap-2 font-mono text-[10px] font-bold">
                    <span>
                      <Num value={seat.chips} /> CHIPS
                    </span>
                    <span
                      className={
                        seat.position > 0 ? "text-buy" : seat.position < 0 ? "text-sell" : ""
                      }
                    >
                      {seat.position > 0 ? "+" : ""}
                      {seat.position}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
