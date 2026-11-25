import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { seatInk } from "@/lib/seat-colors";

/** The solid order card that drops into a capsule: who, which side, how much. */
export function OrderTicket({
  name,
  side,
  size,
  note,
  color,
  className,
}: {
  name: ReactNode;
  side: ReactNode;
  size: ReactNode;
  note?: ReactNode;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn("order-ticket", className)}
      style={{ "--ticket": color, color: seatInk(color) } as CSSProperties}
    >
      <span className="flex items-baseline justify-between gap-3 text-[11px] font-extrabold">
        <span className="truncate">{name}</span>
        {note && <span className="shrink-0 opacity-85">{note}</span>}
      </span>
      <span className="mt-1 block text-base leading-none font-black">{side}</span>
      <span className="block text-2xl leading-tight font-black tabular-nums">{size}</span>
    </span>
  );
}
