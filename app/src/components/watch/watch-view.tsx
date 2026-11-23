"use client";

import NumberFlow from "@number-flow/react";
import { deriveTable, type TableView } from "@insider/sdk";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useInsider } from "@/app/providers";
import { FloorSkeleton, TableOffline } from "@/components/floor/states";
import { useFloor } from "@/components/floor/use-floor";
import { PriceChart } from "@/components/floor/price-chart";
import { Badge } from "@/components/ui/badge";
import { cameraEvent, caption } from "@/lib/captions";
import { useFloorStore } from "@/lib/floor-store";

function Ladder({ view }: { view: TableView }) {
  const active = view.seats.filter((seat) => !seat.isFree).sort((a, b) => b.pnl - a.pnl);
  return (
    <div className="border-line bg-surface flex max-h-72 min-h-0 flex-col overflow-auto rounded-lg border p-6 md:max-h-none">
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
    const source = new EventSource(url);
    source.onmessage = (message) => {
      try {
        const data: unknown = JSON.parse(message.data);
        const text =
          typeof data === "string"
            ? data
            : data && typeof data === "object" && "caption" in data
              ? data.caption
              : "";
        if (typeof text === "string" && text.length > 0 && text.length <= 200) setCommentary(text);
      } catch {
        if (message.data.length <= 200) setCommentary(message.data);
      }
    };
    source.onerror = () => {};
    return () => source.close();
  }, []);
  if (status === "loading") return <FloorSkeleton />;
  if (!snapshot || !view) return <TableOffline />;
  const event = cameraEvent(view, snapshot);
  const line = commentary || (event ? caption(event) : "The tape is quiet. For now.");
  return (
    <main
      style={scale ? { width: 1920, height: 1080, maxWidth: "none" } : undefined}
      className={`watch-screen bg-bg mx-auto flex min-h-[820px] w-full max-w-[1920px] flex-col overflow-hidden p-[2.3%] md:aspect-video md:min-h-0 ${scale ? "watch-record" : ""}`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="border-sealed text-sealed grid size-10 place-items-center border font-mono text-xl">
            I
          </div>
          <span className="font-mono text-xl font-bold tracking-[.2em]">INSIDER</span>
          <span className="text-muted font-mono text-xs">/ THE FLOOR</span>
          {fixture && <Badge tone="opened">Fixture</Badge>}
        </div>
        <div className="text-muted flex items-center gap-5 font-mono text-sm">
          <span className={fixture ? "text-opened" : "text-buy"}>
            ● {fixture ? "SIMULATED" : "LIVE"}
          </span>
          <span>ROUND {view.round}</span>
          <span>T+{view.tick}</span>
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
            className="border-line bg-surface min-w-0 rounded-lg border px-3 py-3"
          >
            <div className="text-muted font-mono text-[10px]">SLOT {leak.slot + 1}</div>
            <div className="mt-2 truncate text-sm">
              {leak.state ? leak.kindName : "Awaiting drop"}
            </div>
            <div className="text-muted mt-1 font-mono text-[10px]">
              {leak.state ? `${leak.rarityName} / ${leak.stateName}` : "—"}
            </div>
          </div>
        ))}
      </div>
      <div className="border-sealed/30 bg-surface mt-4 flex min-h-[70px] shrink-0 items-center gap-5 rounded-lg border px-6">
        <div className="border-sealed/30 text-sealed border-r pr-5 font-mono text-xs tracking-wider">
          AUTO
          <br />
          CAMERA
        </div>
        <div className="text-lg">{line}</div>
      </div>
    </main>
  );
}
