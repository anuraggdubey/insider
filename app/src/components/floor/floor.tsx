"use client";

import NumberFlow from "@number-flow/react";
import { deriveTable } from "@insider/sdk";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowUpRight, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInsider } from "@/app/providers";
import { LeakBoard } from "@/components/leaks/leak-board";
import { GuestControls } from "@/components/onboarding/guest";
import { Badge } from "@/components/ui/badge";
import { PhaseBar } from "@/components/ui/phase-bar";
import { useToast } from "@/components/ui/toast";
import { restoreVault } from "@/lib/floor-actions";
import { updateFloor, useFloorStore } from "@/lib/floor-store";
import { seatsFromXray } from "@/lib/xray-seats";
import { cn } from "@/lib/cn";
import { reducedTransition, spring } from "@/lib/motion";
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
  const recordMode = params.get("record") === "1";
  const [mobileTab, setMobileTab] = useState<"Chart" | "Ticket" | "Leaks" | "Seats" | "Tape">(
    "Chart",
  );
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = useReducedMotion();
  const seenAnnouncements = useRef(new Set<string>());
  useFloor(config, fixtureMode);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const walletKey = useFloorStore((state) => state.walletKey);
  const player = useMemo(
    () => (identity === "wallet" ? walletKey : (guest?.publicKey ?? null)),
    [guest, identity, walletKey],
  );
  const pending = useFloorStore((state) => state.pending);
  const vaults = useFloorStore((state) => state.vaults);
  const error = useFloorStore((state) => state.error);
  const joinRequested = useFloorStore((state) => state.joinRequested);
  const attempted = useRef(new Set<string>());
  const view = useMemo(
    () => snapshot && deriveTable(snapshot, { me: player ?? undefined, pending }),
    [snapshot, player, pending],
  );
  useEffect(() => {
    if (error) useToast.getState().add(error);
  }, [error]);
  useEffect(() => {
    if (status === "offline" && joinRequested) updateFloor({ joinRequested: false });
  }, [status, joinRequested]);
  useEffect(() => {
    if (!view || !player) return;
    for (const leak of view.leaks) {
      const key = `${view.round}:${leak.leakId}:${player.toBase58()}`;
      if (leak.isReader && !vaults[leak.leakId] && !attempted.current.has(key)) {
        attempted.current.add(key);
        void restoreVault(config, leak.slot, leak.leakId).catch(() => {
          setTimeout(() => attempted.current.delete(key), 4_000);
        });
      }
    }
  }, [config, player, view, vaults]);
  useEffect(() => {
    if (!view?.mine) return;
    const events = [
      ...view.feed
        .filter((event) => event.type === "fill" && event.seat === view.mine?.index)
        .map((event) => ({
          key: `${view.round}-fill-${event.tick}-${event.type === "fill" ? `${event.side}-${event.size}-${event.price}` : event.order}`,
          text: `Your order filled at tick ${event.tick}.`,
        })),
      ...view.leaks
        .filter((leak) => leak.isMine && leak.state !== 0)
        .map((leak) => ({
          key: `${view.round}-leak-${leak.leakId}-${leak.state}`,
          text: `${leak.kindName}: ${leak.stateName.toLowerCase()}.`,
        })),
    ];
    const next = events.filter((event) => !seenAnnouncements.current.has(event.key));
    for (const event of events) seenAnnouncements.current.add(event.key);
    if (!next.length) return;
    const timer = setTimeout(() => setAnnouncement(next.map((event) => event.text).join(" ")), 0);
    return () => clearTimeout(timer);
  }, [view]);
  if (status === "loading" || (status === "reconnecting" && !snapshot)) return <FloorSkeleton />;
  if (!snapshot || !view) return <TableOffline />;
  const phaseLabel =
    view.phase === "xray" ? "X-ray" : view.phase[0]?.toUpperCase() + view.phase.slice(1);
  const finalized =
    view.phase === "xray" && snapshot.xray?.finalized === 1 && snapshot.xray.roundId === view.round
      ? snapshot.xray
      : null;
  const finalSeats = finalized ? seatsFromXray(finalized) : [];
  const top = finalSeats
    .filter((seat) => !seat.free)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 3);
  const myScore = finalSeats.find((seat) => seat.owner === player?.toBase58())?.score;
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-24 min-[1440px]:flex min-[1440px]:h-[calc(100dvh-4rem-1px)] min-[1440px]:min-h-0 min-[1440px]:flex-none min-[1440px]:flex-col md:pb-4 lg:px-6",
        recordMode && "record-floor",
      )}
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
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

      {view.phase === "xray" && (
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? reducedTransition : spring}
          className="border-priority/30 bg-surface mb-3 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3"
          aria-label="Round summary"
        >
          <div>
            <div className="micro-label text-priority">Round complete</div>
            <div className="mt-1 text-xs">
              {top.length
                ? top
                    .map((seat) => `${seat.name} ${seat.score! > 0 ? "+" : ""}${seat.score}`)
                    .join(" · ")
                : finalized
                  ? "No occupied seats this round."
                  : "Finalizing round…"}
            </div>
          </div>
          <div className="text-muted font-mono text-[10px]">
            {snapshot.xray?.tagCount ?? 0} SANDWICHES · YOUR SCORE{" "}
            {myScore === null || myScore === undefined ? "—" : myScore}
          </div>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            className="text-sealed ml-auto flex items-center gap-1 text-xs"
          >
            Open X-ray <ArrowUpRight className="size-3" />
          </Link>
        </motion.div>
      )}
      <div className="floor-grid grid grid-cols-1 gap-3 min-[1440px]:min-h-0 min-[1440px]:flex-1 min-[1440px]:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[210px_minmax(0,1fr)_270px] xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        <div className={cn("floor-seats", mobileTab !== "Seats" && "hidden md:block")}>
          <SeatRail view={view} />
        </div>
        <div
          className={cn(
            "floor-chart min-h-[400px] min-[1440px]:min-h-0",
            mobileTab !== "Chart" && "hidden md:block",
          )}
        >
          <PriceChart view={view} vaults={vaults} />
        </div>
        <aside
          className={cn(
            "floor-aside space-y-3 min-[1440px]:h-full min-[1440px]:overflow-y-auto lg:row-span-2 lg:min-h-0 lg:max-[1439px]:h-0",
            mobileTab !== "Ticket" && mobileTab !== "Tape" && "hidden md:block",
          )}
        >
          <div className={cn("floor-ticket", mobileTab !== "Ticket" && "hidden md:block")}>
            <OrderPanel config={config} snapshot={snapshot} view={view} />
          </div>
          <div className={cn("floor-tape", mobileTab !== "Tape" && "hidden md:block")}>
            <Feed view={view} snapshot={snapshot} onPrefill={() => setMobileTab("Ticket")} />
          </div>
        </aside>
        <div
          className={cn("floor-leaks lg:col-span-2", mobileTab !== "Leaks" && "hidden md:block")}
        >
          <LeakBoard config={config} view={view} vaults={vaults} snapshot={snapshot} />
        </div>
      </div>
      <nav
        aria-label="Floor panels"
        className="floor-tabs border-line bg-surface fixed right-0 bottom-0 left-0 z-30 grid grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {(["Chart", "Ticket", "Leaks", "Seats", "Tape"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={mobileTab === tab ? "page" : undefined}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "min-h-14 font-mono text-[10px]",
              mobileTab === tab ? "text-sealed" : "text-muted",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>
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
