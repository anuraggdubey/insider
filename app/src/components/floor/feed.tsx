"use client";

import { useEffect, useRef, useState } from "react";
import type { TableView } from "@insider/sdk";
import { Panel } from "@/components/ui/panel";

type LeakEvent = { key: string; tick: number; text: string };
export function Feed({ view }: { view: TableView }) {
  const previous = useRef<Map<number, { state: number; owner: number }>>(new Map());
  const [leakEvents, setLeakEvents] = useState<LeakEvent[]>([]);
  useEffect(() => {
    const events: LeakEvent[] = [];
    for (const leak of view.leaks) {
      if (leak.state === 0) continue;
      const before = previous.current.get(leak.leakId);
      if (!before && leak.mintedTick <= view.tick)
        events.push({
          key: `${leak.leakId}-drop`,
          tick: leak.mintedTick,
          text: `${leak.kindName} dropped (${leak.rarityName})`,
        });
      else if (before && before.state !== leak.state) {
        const name = view.seats.find((seat) => seat.index === leak.ownerSeat)?.name ?? "A seat";
        if (leak.state === 2 && (before.state === 1 || before.state === 3))
          events.push({
            key: `${leak.leakId}-buy-${view.tick}`,
            tick: view.tick,
            text: `${name} bought a sealed Leak for ${leak.paid}`,
          });
        if (leak.state === 4)
          events.push({
            key: `${leak.leakId}-open`,
            tick: leak.openedTick,
            text: `${name} opened ${leak.kindName}`,
          });
      }
      previous.current.set(leak.leakId, { state: leak.state, owner: leak.ownerSeat });
    }
    if (events.length)
      queueMicrotask(() => setLeakEvents((old) => [...events, ...old].slice(0, 32)));
  }, [view]);
  const rows = [
    ...view.feed.map((event) => {
      const seat =
        view.seats.find((item) => item.index === event.seat)?.name ?? `Seat ${event.seat + 1}`;
      return event.type === "send"
        ? {
            key: `s-${event.tick}-${event.seat}-${event.order}`,
            tick: event.tick,
            text: `${seat} sent a ${event.lane === 1 ? "PRIORITY" : "standard"} order`,
            color: event.lane === 1 ? "text-priority" : "text-sealed",
          }
        : {
            key: `f-${event.tick}-${event.seat}-${event.order}`,
            tick: event.tick,
            text: `${event.seat === 255 ? "Whale" : seat} fill ${event.side > 0 ? "+" : "−"}${event.size.toLocaleString()} @ ${(event.price / 1_000_000).toFixed(4)}`,
            color: event.seat === 255 ? "text-whale" : event.side > 0 ? "text-buy" : "text-sell",
          };
    }),
    ...leakEvents.map((event) => ({ ...event, color: "text-opened" })),
  ]
    .sort((a, b) => b.tick - a.tick)
    .slice(0, 8);
  return (
    <Panel
      title="The tape"
      action={<span className="micro-label">Public activity</span>}
      className="min-h-[220px]"
    >
      {rows.length ? (
        <div className="divide-line divide-y">
          {rows.map((row) => (
            <div key={row.key} className="flex items-start gap-2 px-3 py-2">
              <span className={`${row.color} mt-1.5 size-1 shrink-0 rounded-full bg-current`} />
              <span className="text-muted flex-1 text-[10px] leading-4">{row.text}</span>
              <span className="text-faint font-mono text-[9px]">T+{row.tick}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-faint p-5 text-xs">Waiting for public activity.</p>
      )}
    </Panel>
  );
}
