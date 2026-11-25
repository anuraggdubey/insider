"use client";

import type { TableView } from "@insider/sdk";
import { Bot, Cpu, UserRound } from "lucide-react";
import Link from "next/link";
import { Capsule } from "@/components/ui/capsule";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { seatColor } from "@/lib/seat-colors";

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
                  "seat-capsule shrink-0",
                  pulse && (priority ? "seat-token-priority" : "seat-token-standard"),
                  seat.isFree && !seat.isMe && "opacity-35 grayscale",
                )}
              >
                <Capsule
                  size={38}
                  topColor={seatColor(seat.index, view.mine?.index)}
                  mine={seat.isMe}
                  motion="none"
                  decorative
                />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate text-[13px] font-extrabold",
                    seat.liquidated && "line-through",
                  )}
                >
                  <Icon aria-hidden className="text-faint mr-1 inline size-3 align-[-1px]" />
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
