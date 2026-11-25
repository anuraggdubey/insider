"use client";

import { useEffect, useRef, useState } from "react";
import type { TableSnapshot, TableView } from "@insider/sdk";
import type { PublicKey } from "@solana/web3.js";
import { Panel } from "@/components/ui/panel";
import { updateFloor, useFloorStore } from "@/lib/floor-store";
import { draftForFill } from "@/lib/order-prefill";
import { seatsFromXray } from "@/lib/xray-seats";

type LeakEvent = { key: string; tick: number; round: number; text: string; stamp: string };
export function Feed({
  view,
  snapshot,
  player,
  onPrefill,
}: {
  view: TableView;
  snapshot: TableSnapshot;
  player: PublicKey | null;
  onPrefill?: () => void;
}) {
  const previous = useRef<Map<string, { state: number; owner: number }>>(new Map());
  const sequence = useRef(0);
  const [leakEvents, setLeakEvents] = useState<LeakEvent[]>([]);
  const traceSeats =
    snapshot.xray?.finalized && snapshot.xray.roundId === view.round
      ? seatsFromXray(snapshot.xray)
      : [];
  const myTraceSeat = traceSeats.find((seat) => seat.owner === player?.toBase58())?.index;
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
          round: view.round,
          text: `${leak.kindName} dropped (${leak.rarityName})`,
          stamp: "DROP",
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
            round: view.round,
            text: `${name} bought a sealed Leak for ${leak.paid}`,
            stamp: "SOLD",
          });
        if (leak.state === 4)
          events.push({
            key: `${identity}-open-${++sequence.current}`,
            tick: leak.openedTick,
            round: view.round,
            text: `${name} opened ${leak.kindName}`,
            stamp: "OPENED",
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
            stamp: "SENT",
            fill: null,
          }
        : {
            key: `f-${event.tick}-${event.seat}-${event.order}`,
            tick: event.tick,
            text: `${event.seat === 255 ? "Whale" : seat} fill ${event.side > 0 ? "+" : "−"}${event.size.toLocaleString()} @ ${(event.price / 1_000_000).toFixed(4)}`,
            color: event.seat === 255 ? "text-whale" : event.side > 0 ? "text-buy" : "text-sell",
            stamp: "FILLED",
            fill: event,
          };
    }),
    ...leakEvents
      .filter((event) => event.round === view.round)
      .map((event) => ({ ...event, color: "text-opened", fill: undefined })),
    ...(snapshot.xray?.finalized && snapshot.xray.roundId === view.round
      ? snapshot.xray.tags.slice(0, snapshot.xray.tagCount).map((tag, index) => ({
          key: `tag-${index}-${tag.frontTick}`,
          tick: tag.victimTick,
          text: `${traceSeats[tag.front]?.name ?? `Seat ${tag.front + 1}`} front-ran ${traceSeats[tag.victim]?.name ?? `Seat ${tag.victim + 1}`} · ${tag.profitEstimate >= 0 ? "+" : ""}${tag.profitEstimate} estimated chips`,
          color: "text-priority",
          stamp: tag.front === myTraceSeat ? "FRONT-RUN" : "SANDWICH",
          fill: undefined,
        }))
      : []),
  ]
    .sort((a, b) => b.tick - a.tick)
    .slice(0, 8);
  return (
    <Panel
      title="Game log"
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
                className="group hover:bg-surface-2 flex items-start gap-2 px-3 py-2"
              >
                <span className={`${row.color} feed-chip mt-0.5 shrink-0`}>{row.stamp}</span>
                <span className="text-ink min-w-0 flex-1 text-xs leading-5 font-semibold">
                  {row.text}
                  {row.fill !== undefined && (
                    <span className="ml-2 inline-flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={!copy}
                        title={
                          row.fill
                            ? "Prefill the same side and size"
                            : "Side and size are private until fill"
                        }
                        onClick={() => makeDraft(false)}
                        className="border-line-strong bg-surface text-brand disabled:text-faint cursor-pointer rounded-full border-2 px-2 text-[10px] font-extrabold disabled:cursor-default disabled:opacity-60"
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
                        className="border-line-strong bg-surface text-brand disabled:text-faint cursor-pointer rounded-full border-2 px-2 text-[10px] font-extrabold disabled:cursor-default disabled:opacity-60"
                      >
                        Fade
                      </button>
                    </span>
                  )}
                </span>
                <span className="text-faint font-mono text-[10px] leading-5">T+{row.tick}</span>
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
