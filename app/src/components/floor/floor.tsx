"use client";

import { deriveTable } from "@insider/sdk/view";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  CandlestickChart,
  Gift,
  LockKeyhole,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInsider } from "@/app/providers";
import { LeakBoard } from "@/components/leaks/leak-board";
import { buttonStyles } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { selectGuest, updateFloor, useFloorStore } from "@/lib/floor-store";
import { createGuest } from "@/lib/guest";
import { seatsFromXray } from "@/lib/xray-seats";
import { cn } from "@/lib/cn";
import { reducedTransition, spring } from "@/lib/motion";
import { playSound } from "@/lib/sound";
import { floorSoundEvents, type FloorSoundState } from "@/lib/sound-events";
import { FloorCoach } from "./coach";
import { Feed } from "./feed";
import { HowToPlay, useFirstVisitGuide } from "./how-to-play";
import { FloorHud, PhaseBanner } from "./hud";
import { MempoolLanes } from "./mempool-lanes";
import { OrderPanel } from "./order-panel";
import { PriceChart } from "./lazy-price-chart";
import { SeatRail } from "./seat-rail";
import { FloorSkeleton, TableOffline } from "./states";
import { useFloor } from "./use-floor";

const tabIcons = { Trade: CandlestickChart, Capsules: Gift, Seats: Users, Log: ScrollText };

export function Floor() {
  const config = useInsider();
  const params = useSearchParams();
  const fixtureMode = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const recordMode = params.get("record") === "1";
  const [mobileTab, setMobileTab] = useState<"Trade" | "Capsules" | "Seats" | "Log">("Trade");
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = useReducedMotion();
  const seenAnnouncements = useRef(new Set<string>());
  const soundState = useRef<FloorSoundState | null>(null);
  useFloor(config, fixtureMode);
  useFirstVisitGuide();
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
  // `/table?join=1` (from the Desk or a link): take a guest seat once the table has loaded.
  const autoJoin = params.get("join") === "1";
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!autoJoin || autoJoined.current || !snapshot) return;
    autoJoined.current = true;
    if (view?.mine) return;
    updateFloor({ guide: false });
    const { identity, wallet } = useFloorStore.getState();
    if (identity !== "wallet" || !wallet) selectGuest(createGuest());
    void import("@/lib/floor-actions")
      .then(({ joinFloor }) => joinFloor(config))
      .catch((cause: unknown) => useToast.getState().add(friendlyError(cause)));
  }, [autoJoin, config, snapshot, view?.mine]);
  useEffect(() => {
    if (status === "offline" && joinRequested) updateFloor({ joinRequested: false });
  }, [status, joinRequested]);
  useEffect(() => {
    if (!snapshot || !view) return;
    const events = floorSoundEvents(soundState.current, snapshot, view.mine?.index);
    soundState.current = events.next;
    if (events.drop) playSound("drop");
    if (events.fill) playSound("fill");
  }, [snapshot, view]);
  useEffect(() => {
    if (!view || !player) return;
    for (const leak of view.leaks) {
      const key = `${view.round}:${leak.leakId}:${player.toBase58()}`;
      if (leak.isReader && !vaults[leak.leakId] && !attempted.current.has(key)) {
        attempted.current.add(key);
        void import("@/lib/floor-actions")
          .then(({ restoreVault }) => restoreVault(config, leak.slot, leak.leakId))
          .catch(() => {
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
  const finalized =
    view.phase === "xray" && snapshot.xray?.finalized === 1 && snapshot.xray.roundId === view.round
      ? snapshot.xray
      : null;
  const finalSeats = finalized ? seatsFromXray(finalized) : [];
  const ranked = finalSeats.filter((seat) => !seat.free).sort((a, b) => b.score! - a.score!);
  const top = ranked.slice(0, 3);
  const finalMine = ranked.find((seat) => seat.owner === player?.toBase58());
  const myScore = finalMine?.score;
  const myRank = finalMine ? ranked.findIndex((seat) => seat.index === finalMine.index) + 1 : null;
  const tags = finalized?.tags.slice(0, finalized.tagCount) ?? [];
  const myFrontRuns = tags.filter((tag) => tag.front === finalMine?.index).length;
  const myVictimizations = tags.filter((tag) => tag.victim === finalMine?.index).length;
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-24 min-[1440px]:flex min-[1440px]:min-h-[calc(100dvh-4rem-1px)] min-[1440px]:flex-col md:pb-4 lg:px-6",
        recordMode && "record-floor",
      )}
    >
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <FloorHud config={config} view={view} status={status} />
      <PhaseBanner
        key={`${view.round}-${view.phase}`}
        round={view.round}
        phase={view.phase}
        fixture={fixtureMode}
      />
      <FloorCoach
        config={config}
        view={view}
        xrayHref={fixtureMode ? "/xray?fixture=1" : "/xray"}
        onShowTrade={setMobileTab}
      />
      <HowToPlay config={config} view={view} />

      {(view.phase === "idle" || view.phase === "seeding") && (
        <div className="border-line bg-surface mb-3 flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <span className="text-sm">Between rounds</span>
            <span className="text-muted ml-3 text-xs">The next round is being prepared.</span>
          </div>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            prefetch={false}
            className="text-brand flex items-center gap-1 font-mono text-[10px]"
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
          className="bg-surface mb-3 flex flex-wrap items-center gap-4 rounded-2xl border-[3px] border-[#0f1f5c] px-4 py-3 shadow-[0_5px_0_#0f1f5c]"
          aria-label="Round summary"
        >
          <div>
            <Stamp className="text-priority">Round complete</Stamp>
            <div className="mt-2.5 text-sm font-extrabold">
              {top.length
                ? top
                    .map((seat) => `${seat.name} ${seat.score! > 0 ? "+" : ""}${seat.score}`)
                    .join(" · ")
                : finalized
                  ? "No occupied seats this round."
                  : "Finalizing round…"}
            </div>
          </div>
          <div className="text-muted font-mono text-[11px] font-bold">
            {finalized?.tagCount ?? "—"} SANDWICHES · YOUR SCORE{" "}
            {myScore === null || myScore === undefined
              ? "—"
              : `${myScore > 0 ? "+" : ""}${myScore}`}
            {" · "}RANK {myRank ?? "—"} · YOUR FRONT-RUNS {finalMine ? myFrontRuns : "—"}
            {" · "}CAUGHT {finalMine ? myVictimizations : "—"}
          </div>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            prefetch={false}
            className={buttonStyles({ variant: "primary", size: "sm", className: "ml-auto" })}
          >
            Open X-ray <ArrowUpRight className="size-3" />
          </Link>
        </motion.div>
      )}
      <div className="floor-grid grid grid-cols-1 gap-3 min-[1440px]:flex-1 min-[1440px]:grid-rows-[minmax(480px,1fr)_auto] lg:grid-cols-[210px_minmax(0,1fr)_270px] xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        <div className={cn("floor-seats", mobileTab !== "Seats" && "hidden md:block")}>
          <SeatRail view={view} />
        </div>
        <div
          className={cn(
            "floor-chart flex min-h-[400px] flex-col gap-3 min-[1440px]:min-h-0",
            mobileTab !== "Trade" && "hidden md:flex",
          )}
        >
          <div className="min-h-[280px] min-[1440px]:flex-1">
            <PriceChart view={view} vaults={vaults} />
          </div>
          <MempoolLanes snapshot={snapshot} view={view} />
        </div>
        <aside
          className={cn(
            "floor-aside space-y-3 min-[1440px]:h-full min-[1440px]:overflow-y-auto lg:row-span-2 lg:min-h-0 lg:max-[1439px]:h-0",
            mobileTab !== "Trade" && mobileTab !== "Log" && "hidden md:block",
          )}
        >
          <div className={cn("floor-ticket", mobileTab !== "Trade" && "hidden md:block")}>
            <OrderPanel config={config} snapshot={snapshot} view={view} />
          </div>
          <div className={cn("floor-tape", mobileTab !== "Log" && "hidden md:block")}>
            <Feed
              view={view}
              snapshot={snapshot}
              player={player}
              onPrefill={() => setMobileTab("Trade")}
            />
          </div>
        </aside>
        <div
          className={cn("floor-leaks lg:col-span-2", mobileTab !== "Capsules" && "hidden md:block")}
        >
          <LeakBoard config={config} view={view} vaults={vaults} snapshot={snapshot} />
        </div>
      </div>
      <nav
        aria-label="Floor panels"
        className="floor-tabs border-primary bg-surface fixed right-0 bottom-0 left-0 z-30 grid grid-cols-4 gap-1 border-t-[3px] px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {(["Trade", "Capsules", "Seats", "Log"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-current={mobileTab === tab ? "page" : undefined}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "my-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-extrabold",
              mobileTab === tab ? "bg-primary text-white" : "text-muted",
            )}
          >
            <TabIcon tab={tab} />
            {tab}
          </button>
        ))}
      </nav>
      <div className="text-muted flex flex-wrap items-center justify-between gap-2 py-4 font-mono text-[10px] font-bold tracking-wider">
        <span className="flex items-center gap-2">
          <Activity className="size-3" />{" "}
          {status === "fixture"
            ? "SIMULATED MARKET · NOT ON CHAIN"
            : "PUBLIC TRACES · PRIVATE ORDER FLOW"}
        </span>
        <div className="flex items-center gap-4">
          <Link href="/table/privacy" className="hover:text-brand flex items-center gap-1">
            <LockKeyhole className="size-3" /> PRIVACY CHECK
          </Link>
          <Link
            href={fixtureMode ? "/xray?fixture=1" : "/xray"}
            prefetch={false}
            className="hover:text-brand flex items-center gap-1"
          >
            X-RAY <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>
    </main>
  );
}

function TabIcon({ tab }: { tab: keyof typeof tabIcons }) {
  const Icon = tabIcons[tab];
  return <Icon aria-hidden className="size-4" />;
}
