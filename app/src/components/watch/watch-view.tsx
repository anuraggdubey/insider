"use client";

import NumberFlow from "@number-flow/react";
import type { TableView } from "@insider/sdk";
import { deriveTable } from "@insider/sdk/view";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useInsider } from "@/app/providers";
import { FloorSkeleton, TableOffline } from "@/components/floor/states";
import { useFloor } from "@/components/floor/use-floor";
import { PriceChart } from "@/components/floor/lazy-price-chart";
import { Badge } from "@/components/ui/badge";
import { Capsule } from "@/components/ui/capsule";
import { cameraEvent, caption } from "@/lib/captions";
import { useFloorStore } from "@/lib/floor-store";

function Ladder({ view }: { view: TableView }) {
  const active = view.seats.filter((seat) => !seat.isFree).sort((a, b) => b.pnl - a.pnl);
  return (
    <div
      role="region"
      aria-label="Public equity ladder"
      tabIndex={0}
      className="border-line bg-surface flex max-h-72 min-h-0 flex-col overflow-auto rounded-lg border p-6 md:max-h-none"
    >
      <div className="micro-label">The ladder / public equity</div>
      <div className="mt-4 flex-1 space-y-1">
        {active.map((seat, index) => (
          <div key={seat.index} className="border-line flex items-center gap-3 border-b py-3">
            <span className="text-muted w-5 font-mono text-sm">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base">{seat.name}</div>
              <div className="text-muted mt-1 font-mono text-[10px] uppercase">{seat.kind}</div>
            </div>
            <span className={`font-mono text-lg ${seat.pnl >= 0 ? "text-buy" : "text-sell"}`}>
              {seat.pnl > 0 ? "+" : ""}
              {seat.pnl}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WatchView() {
  const config = useInsider();
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const scale = params.get("scale") === "1";
  useFloor(config, fixture);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const [commentary, setCommentary] = useState("");
  const view = useMemo(() => snapshot && deriveTable(snapshot), [snapshot]);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_COMMENTARY_URL;
    if (!url) return;
    // The caption feed (bots/src/ai) is plain JSON: GET /captions?since=<id> → { captions: [{ id, text }] }.
    let since = 0;
    let closed = false;
    const poll = async () => {
      try {
        const feed = new URL(url);
        feed.searchParams.set("since", String(since));
        const response = await fetch(feed, { cache: "no-store" });
        const data = (await response.json()) as { captions?: { id: number; text: string }[] };
        const latest = data.captions?.at(-1);
        if (!closed && latest) {
          since = latest.id;
          if (latest.text.length > 0 && latest.text.length <= 200) setCommentary(latest.text);
        }
      } catch {
        // Feed unreachable: keep the last caption and try again on the next tick.
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, []);
  if (status === "loading") return <FloorSkeleton />;
  if (!snapshot || !view) return <TableOffline />;
  const event = cameraEvent(view, snapshot);
  const line = commentary || (event ? caption(event) : "The tape is quiet. For now.");
  return (
    <main
      style={scale ? { width: 1920, height: 1080, maxWidth: "none" } : undefined}
      className={`watch-screen screen mx-auto flex min-h-[820px] w-full max-w-[1920px] flex-col overflow-hidden p-[2.3%] md:aspect-video md:min-h-0 ${scale ? "watch-record" : ""}`}
    >
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="border-sealed text-sealed grid size-10 shrink-0 place-items-center border font-mono text-xl">
            I
          </div>
          <span className="font-mono text-xl font-bold tracking-[.2em]">INSIDER</span>
          <span className="text-muted hidden font-mono text-xs sm:inline">/ THE FLOOR</span>
          {fixture && <Badge tone="opened">Fixture</Badge>}
        </div>
        <div className="text-muted flex min-w-0 items-center gap-x-4 font-mono text-xs whitespace-nowrap sm:gap-x-5 sm:text-sm">
          <span
            className={`rounded-sm px-2 py-1 font-bold text-[#0d1633] ${fixture ? "bg-opened" : "bg-sell"}`}
          >
            ● {fixture ? "SIMULATED" : "LIVE"}
          </span>
          <span className="border-line-strong flex gap-3 rounded-sm border px-2 py-1">
            <span>ROUND {view.round}</span>
            <span>T+{view.tick}</span>
          </span>
        </div>
      </div>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_24%]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="micro-label">Floor / mark price</div>
              <div className="mt-1 font-mono text-5xl">
                <NumberFlow
                  value={view.price / 1_000_000}
                  format={{ minimumFractionDigits: 4, maximumFractionDigits: 4 }}
                />
              </div>
            </div>
            <div className="text-muted font-mono text-xs uppercase">
              {view.phase} / {view.secondsLeft.toFixed(1)}s
            </div>
          </div>
          <div className="min-h-[300px] flex-1 md:min-h-0">
            <PriceChart view={view} vaults={{}} />
          </div>
        </div>
        <Ladder view={view} />
      </div>
      <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-6">
        {view.leaks.map((leak) => (
          <div
            key={leak.slot}
            className="border-line bg-surface flex min-w-0 items-center gap-2 rounded-lg border px-3 py-3"
          >
            {leak.state ? (
              <Capsule
                size={32}
                rarity={leak.rarity === 2 ? "epic" : leak.rarity === 1 ? "rare" : "common"}
                state={
                  leak.state === 2
                    ? "owned"
                    : leak.state === 3
                      ? "listed"
                      : leak.state === 4
                        ? "opened"
                        : leak.state === 5
                          ? "expired"
                          : "sealed"
                }
                motion="none"
              />
            ) : (
              <span
                aria-hidden="true"
                className="border-line-strong size-8 shrink-0 rounded-full border border-dashed"
              />
            )}
            <div className="min-w-0">
              <div className="text-muted font-mono text-[10px]">SLOT {leak.slot + 1}</div>
              <div className="mt-1 truncate text-xs">{leak.state ? leak.kindName : "Empty"}</div>
              <div className="text-muted mt-1 truncate font-mono text-[9px]">
                {leak.state ? `${leak.rarityName} / ${leak.stateName}` : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-signal/50 bg-surface mt-4 flex min-h-[70px] shrink-0 items-center gap-5 rounded-lg border px-3">
        <div className="bg-signal rounded-sm px-3 py-2 font-mono text-xs font-bold tracking-wider text-[#0d1633]">
          AUTO
          <br />
          CAMERA
        </div>
        <div className="text-lg">{line}</div>
      </div>
    </main>
  );
}
