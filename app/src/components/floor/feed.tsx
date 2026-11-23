"use client";

import { useEffect, useRef, useState } from "react";
import type { TableSnapshot, TableView } from "@insider/sdk";
import { Panel } from "@/components/ui/panel";
import { updateFloor, useFloorStore } from "@/lib/floor-store";
import { draftForFill } from "@/lib/order-prefill";

type LeakEvent = { key: string; tick: number; text: string };
export function Feed({
  view,
  snapshot,
  onPrefill,
}: {
  view: TableView;
  snapshot: TableSnapshot;
  onPrefill?: () => void;
}) {
  const previous = useRef<Map<string, { state: number; owner: number }>>(new Map());
  const sequence = useRef(0);
  const [leakEvents, setLeakEvents] = useState<LeakEvent[]>([]);
  useEffect(() => {
    const events: LeakEvent[] = [];
    for (const leak of view.leaks) {
      if (leak.state === 0) continue;
      const identity = `${view.round}:${leak.leakId}`;
      const before = previous.current.get(identity);
      if (!before && leak.mintedTick <= view.tick)
        events.push({
          key: `${identity}-drop-${++sequence.current}`,
          tick: leak.mintedTick,
          text: `${leak.kindName} dropped (${leak.rarityName})`,
        });
      else if (before && before.state !== leak.state) {
        const name = view.seats.find((seat) => seat.index === leak.ownerSeat)?.name ?? "A seat";
        if (
          leak.state === 2 &&
          (before.state === 1 || (before.state === 3 && before.owner !== leak.ownerSeat))
        )
          events.push({
            key: `${identity}-buy-${++sequence.current}`,
            tick: view.tick,
            text: `${name} bought a sealed Leak for ${leak.paid}`,
          });
        if (leak.state === 4)
          events.push({
            key: `${identity}-open-${++sequence.current}`,
            tick: leak.openedTick,
            text: `${name} opened ${leak.kindName}`,
          });
      }
      previous.current.set(identity, { state: leak.state, owner: leak.ownerSeat });
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
            fill: null,
          }
        : {
            key: `f-${event.tick}-${event.seat}-${event.order}`,
            tick: event.tick,
            text: `${event.seat === 255 ? "Whale" : seat} fill ${event.side > 0 ? "+" : "−"}${event.size.toLocaleString()} @ ${(event.price / 1_000_000).toFixed(4)}`,
            color: event.seat === 255 ? "text-whale" : event.side > 0 ? "text-buy" : "text-sell",
            fill: event,
          };
    }),
    ...leakEvents.map((event) => ({ ...event, color: "text-opened", fill: undefined })),
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
          {rows.map((row) => {
            const copy = draftForFill(row.fill, view, snapshot.table.params, false);
            const fade = draftForFill(row.fill, view, snapshot.table.params, true);
            const makeDraft = (fade: boolean) => {
              const draft = fade ? draftForFill(row.fill, view, snapshot.table.params, true) : copy;
              if (!draft) return;
              updateFloor({
                orderDraft: {
                  ...draft,
                  id: (useFloorStore.getState().orderDraft?.id ?? 0) + 1,
                },
              });
              onPrefill?.();
            };
            return (
              <div
                key={row.key}
                tabIndex={row.fill !== undefined ? 0 : undefined}
                aria-label={
                  row.fill === null
                    ? `${row.text}. Side and size are private until fill.`
                    : row.fill
                      ? `${row.text}. Press C to copy or F to fade.`
                      : undefined
                }
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key.toLowerCase() === "c") {
                    event.preventDefault();
                    makeDraft(false);
                  }
                  if (event.key.toLowerCase() === "f") {
                    event.preventDefault();
                    makeDraft(true);
                  }
                }}
                className="flex items-start gap-2 px-3 py-2"
              >
                <span className={`${row.color} mt-1.5 size-1 shrink-0 rounded-full bg-current`} />
                <span className="text-muted flex-1 text-[10px] leading-4">
                  {row.text}
                  {row.fill !== undefined && (
                    <span className="mt-1 flex gap-2">
                      <button
                        type="button"
                        disabled={!copy}
                        title={
                          row.fill
                            ? "Prefill the same side and size"
                            : "Side and size are private until fill"
                        }
                        onClick={() => makeDraft(false)}
                        className="text-sealed disabled:text-muted"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        disabled={!fade}
                        title={
                          row.fill
                            ? "Prefill the opposite side"
                            : "Side and size are private until fill"
                        }
                        onClick={() => makeDraft(true)}
                        className="text-sealed disabled:text-muted"
                      >
                        Fade
                      </button>
                    </span>
                  )}
                </span>
                <span className="text-faint font-mono text-[9px]">T+{row.tick}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-faint p-5 text-xs">Waiting for public activity.</p>
      )}
    </Panel>
  );
}
