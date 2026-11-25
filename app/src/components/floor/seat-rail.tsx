"use client";

import { LockKeyhole, UnlockKeyhole } from "lucide-react";
import type { TableView } from "@insider/sdk";
import type { PublicKey } from "@solana/web3.js";
import { Badge } from "@/components/ui/badge";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export function SeatRail({ view }: { view: TableView }) {
  return (
    <Panel
      title="The table"
      action={<span className="micro-label">10 seats</span>}
      className="h-[470px] min-[1440px]:flex min-[1440px]:h-full min-[1440px]:min-h-0 min-[1440px]:flex-col"
    >
      <div className="divide-line divide-y min-[1440px]:flex min-[1440px]:min-h-0 min-[1440px]:flex-1 min-[1440px]:flex-col min-[1440px]:overflow-y-auto">
        {view.seats.map((seat) => {
          const leak = view.leaks.find(
            (item) =>
              item.state >= 2 &&
              item.state <= 4 &&
              (item.ownerSeat === seat.index ||
                item.readers
                  .slice(0, item.readerCount)
                  .some((reader: PublicKey) => reader.equals(seat.owner))),
          );
          const pulse = seat.lastSend?.lane === 1 && view.tick - seat.lastSend.tick <= 2;
          return (
            <div
              key={seat.index}
              className={cn(
                "relative h-[42px] px-3 py-1.5 min-[1440px]:h-auto min-[1440px]:min-h-[30px] min-[1440px]:flex-1 min-[1440px]:py-0.5",
                seat.isMe && "bg-sealed/8",
                pulse && "bg-priority/10",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-faint w-4 font-mono text-[9px]">
                  {String(seat.index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11px]",
                    seat.isFree && "text-faint",
                    seat.liquidated && "text-muted line-through",
                  )}
                >
                  {seat.isFree ? "Open seat" : seat.name}
                  {seat.isMe && (
                    <span className="text-sealed ml-1.5 font-mono text-[8px]">YOU</span>
                  )}
                </span>
                {leak &&
                  (leak.state === 4 ? (
                    <UnlockKeyhole className="text-opened size-3" />
                  ) : (
                    <LockKeyhole className="text-sealed size-3" />
                  ))}
                {pulse && <span className="bg-priority size-1.5 animate-pulse rounded-full" />}
                <Badge tone="neutral" className="border-0 px-1 py-0 text-[8px]">
                  {seat.kind}
                </Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-2 pl-[22px]">
                <div className="bg-line h-0.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className={cn("h-full", seat.position < 0 ? "bg-sell/70" : "bg-buy/70")}
                    style={{ width: `${Math.min(100, Math.abs(seat.position) / 50)}%` }}
                  />
                </div>
                <span className="text-faint w-11 text-right font-mono text-[9px]">
                  {seat.position > 0 ? "+" : ""}
                  {seat.position}
                </span>
                <Num value={seat.pnl} kind="delta" className="w-11 text-right text-[9px]" />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
