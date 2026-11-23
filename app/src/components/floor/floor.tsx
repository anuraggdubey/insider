"use client";

import NumberFlow from "@number-flow/react";
import { deriveTable } from "@insider/sdk";
import { Activity, ArrowUpRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useInsider } from "@/app/providers";
import { LeakBoard } from "@/components/leaks/leak-board";
import { GuestControls } from "@/components/onboarding/guest";
import { Badge } from "@/components/ui/badge";
import { PhaseBar } from "@/components/ui/phase-bar";
import { useToast } from "@/components/ui/toast";
import { restoreVault } from "@/lib/floor-actions";
import { useFloorStore } from "@/lib/floor-store";
import { Feed } from "./feed";
import { OrderPanel } from "./order-panel";
import { PriceChart } from "./price-chart";
import { SeatRail } from "./seat-rail";
import { FloorSkeleton, TableOffline } from "./states";
import { useFloor } from "./use-floor";

export function Floor() {
  const config = useInsider();
  const params = useSearchParams();
  const fixtureMode = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  useFloor(config, fixtureMode);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const guest = useFloorStore((state) => state.guest);
  const pending = useFloorStore((state) => state.pending);
  const vaults = useFloorStore((state) => state.vaults);
  const error = useFloorStore((state) => state.error);
  const attempted = useRef(new Set<string>());
  const view = useMemo(
    () => snapshot && deriveTable(snapshot, { me: guest?.publicKey, pending }),
    [snapshot, guest, pending],
  );
  useEffect(() => {
    if (error) useToast.getState().add(error);
  }, [error]);
  useEffect(() => {
    if (!view || !guest) return;
    for (const leak of view.leaks) {
      const key = `${view.round}:${leak.leakId}:${guest.publicKey.toBase58()}`;
      if (leak.isReader && !vaults[leak.leakId] && !attempted.current.has(key)) {
        attempted.current.add(key);
        void restoreVault(config, leak.slot, leak.leakId).catch(() => {
          setTimeout(() => attempted.current.delete(key), 4_000);
        });
      }
    }
  }, [config, guest, view, vaults]);
  if (status === "loading" || (status === "reconnecting" && !snapshot)) return <FloorSkeleton />;
  if (!snapshot || !view) return <TableOffline />;
  const phaseLabel =
    view.phase === "xray" ? "X-ray" : view.phase[0]?.toUpperCase() + view.phase.slice(1);
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 min-[1440px]:flex min-[1440px]:h-[calc(100dvh-4rem-1px)] min-[1440px]:min-h-0 min-[1440px]:flex-none min-[1440px]:flex-col lg:px-6">
      <div className="border-line bg-surface mb-3 flex min-h-[86px] shrink-0 flex-wrap items-center gap-5 rounded-lg border px-4 py-3">
        <div className="min-w-28">
          <div className="micro-label">
            The floor <span className="text-faint">/ 01</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium">
            {phaseLabel}
            <span className="text-faint font-mono text-[10px]">
              ROUND {String(view.round).padStart(2, "0")}
            </span>
          </div>
        </div>
        <PhaseBar tick={view.tick} className="w-56 max-w-full flex-1 basis-full md:basis-auto" />
        <div className="border-line hidden border-l pl-5 md:block">
          <div className="micro-label">Tick / phase ends</div>
          <div className="mt-1 font-mono text-xs tabular-nums">
            {view.tick} <span className="text-faint">/</span>{" "}
            <NumberFlow
              value={view.secondsLeft}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
            s
          </div>
        </div>
        <div className="border-line hidden border-l pl-5 lg:block">
          <div className="micro-label">Connection</div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px]">
            <span
              className={
                status === "reconnecting"
                  ? "bg-opened size-1.5 rounded-full"
                  : "bg-buy size-1.5 rounded-full"
              }
            />
            {status === "fixture"
              ? "LOCAL SIMULATION"
              : status === "reconnecting"
                ? "RECONNECTING"
                : "TEE LIVE"}
          </div>
        </div>
        {status === "fixture" && <Badge tone="opened">Fixture</Badge>}
        <div className="ml-auto">
          <GuestControls config={config} view={view} />
        </div>
      </div>

      {(view.phase === "idle" || view.phase === "seeding") && (
        <div className="border-line bg-surface mb-3 flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <span className="text-sm">Between rounds</span>
            <span className="text-muted ml-3 text-xs">The next round is being prepared.</span>
          </div>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            className="text-sealed flex items-center gap-1 font-mono text-[10px]"
          >
            LAST X-RAY <ArrowUpRight className="size-3" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[1440px]:min-h-0 min-[1440px]:flex-1 min-[1440px]:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[210px_minmax(0,1fr)_270px] xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        <SeatRail view={view} />
        <PriceChart view={view} vaults={vaults} />
        <aside className="space-y-3 min-[1440px]:h-full min-[1440px]:overflow-y-auto lg:row-span-2 lg:min-h-0 lg:max-[1439px]:h-0">
          <OrderPanel config={config} snapshot={snapshot} view={view} />
          <Feed view={view} />
        </aside>
        <div className="lg:col-span-2">
          <LeakBoard config={config} view={view} vaults={vaults} />
        </div>
      </div>
      <div className="text-faint flex items-center justify-between py-4 font-mono text-[9px] tracking-wider">
        <span className="flex items-center gap-2">
          <Activity className="size-3" />{" "}
          {status === "fixture"
            ? "SIMULATED MARKET · NOT ON CHAIN"
            : "PUBLIC TRACES · PRIVATE ORDER FLOW"}
        </span>
        <div className="flex items-center gap-4">
          <Link href="/table/privacy" className="hover:text-sealed flex items-center gap-1">
            <LockKeyhole className="size-3" /> PRIVACY CHECK
          </Link>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            className="hover:text-sealed flex items-center gap-1"
          >
            X-RAY <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>
    </main>
  );
}
