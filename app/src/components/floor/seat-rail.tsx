"use client";

import type { TableView } from "@insider/sdk";
import { Bot, Cpu, UserRound } from "lucide-react";
import Link from "next/link";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export function SeatRail({ view }: { view: TableView }) {
  return (
    <Panel
      title="Players"
      action={<span className="micro-label">10 seats</span>}
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
                "flex min-h-[40px] items-center gap-2 px-3 py-1",
                seat.isMe && "bg-you/10",
              )}
            >
              <div
                key={`${seat.index}-${pulse ? seat.lastSend?.tick : "idle"}`}
                className={cn(
                  "border-ink flex size-8 shrink-0 flex-col overflow-hidden rounded-full border-2",
                  pulse && (priority ? "seat-token-priority" : "seat-token-standard"),
                )}
              >
                <div
                  className={cn(
                    "grid h-1/2 place-items-center",
                    seat.isMe ? "bg-you text-white" : "bg-ink text-surface",
                    priority && "bg-signal !text-[#161513]",
                  )}
                >
                  <Icon aria-hidden className="size-3" />
                </div>
                <div className="border-ink grid h-1/2 place-items-center border-t bg-[#f8f7f4] font-mono text-[7px] font-bold text-[#161513]">
                  {String(seat.index + 1).padStart(2, "0")}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate text-[11px] font-bold",
                    seat.liquidated && "line-through",
                  )}
                >
                  {seat.isFree ? "Open seat" : seat.name}
                  {seat.isMe && (
                    <span className="ml-1 font-mono text-[9px] text-[#2342c0] dark:text-[#9eafff]">
                      YOU
                    </span>
                  )}
                </div>
                {seat.isFree && seat.kind === "human" ? (
                  <Link href="#join-seat" className="text-you font-mono text-[9px] font-bold">
                    JOIN
                  </Link>
                ) : (
                  <div className="text-muted flex gap-2 font-mono text-[9px]">
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
