"use client";

import { TICK_MILLIS } from "@insider/sdk/constants";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInsider } from "@/app/providers";
import { LeakBoard } from "@/components/leaks/leak-board";
import { useJoin } from "@/components/onboarding/use-join";
import { buttonStyles } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { Stamp } from "@/components/ui/stamp";
import { useToast } from "@/components/ui/toast";
import { loadFloorPrefs, markGuideSeen, useFloorPrefs } from "@/lib/floor-prefs";
import { updateFloor, useFloorStore } from "@/lib/floor-store";
import { seatsFromXray } from "@/lib/xray-seats";
import { cn } from "@/lib/cn";
import { reducedTransition, spring } from "@/lib/motion";
import { ordinal, seatAvailable, signed } from "@/lib/onboarding";
import { seatColor } from "@/lib/seat-colors";
import { playSound } from "@/lib/sound";
import { floorSoundEvents, type FloorSoundState } from "@/lib/sound-events";
import { Feed } from "./feed";
import { GuideDialog } from "./guide-dialog";
import { FloorHud, PhaseBanner } from "./hud";
import { MempoolLanes } from "./mempool-lanes";
import { NextStepBar } from "./next-step";
import { OrderPanel } from "./order-panel";
import { PriceChart } from "./lazy-price-chart";
import { SeatRail } from "./seat-rail";
import { FloorSkeleton, TableOffline } from "./states";
import { FloorTour, tourStops } from "./tour";
import { useFloor } from "./use-floor";

const tabIcons = { Trade: CandlestickChart, Capsules: Gift, Seats: Users, Log: ScrollText };

export function Floor() {
  const config = useInsider();
  const params = useSearchParams();
  const fixtureMode = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const recordMode = params.get("record") === "1";
  const [mobileTab, setMobileTab] = useState<"Trade" | "Capsules" | "Seats" | "Log">("Trade");
  const [announcement, setAnnouncement] = useState("");
  const [guideAsked, setGuideAsked] = useState(false);
  const [touring, setTouring] = useState(false);
  const [spot, setSpot] = useState<"trade" | "capsules" | null>(null);
  const prefs = useFloorPrefs();
  const tutorial = useFloorStore((state) => state.tutorial);
  const { joining, seat: takeSeat, joinAsGuest } = useJoin(config);
  useEffect(loadFloorPrefs, []);
  useEffect(() => {
    if (!spot) return;
    const timer = setTimeout(() => setSpot(null), 1_800);
    return () => clearTimeout(timer);
  }, [spot]);
  const goTo = useCallback((target: "trade" | "capsules") => {
    setMobileTab(target === "trade" ? "Trade" : "Capsules");
    setSpot(target);
    // Give a phone tab switch a frame to paint before scrolling to the panel.
    setTimeout(() => {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .querySelector(`[data-tour="${target}"]`)
        ?.scrollIntoView({ block: "start", behavior: calm ? "instant" : "smooth" });
    }, 60);
  }, []);
  const reducedMotion = useReducedMotion();
  const seenAnnouncements = useRef(new Set<string>());
  const soundState = useRef<FloorSoundState | null>(null);
  useFloor(config, fixtureMode);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const walletKey = useFloorStore((state) => state.walletKey);
  const wallet = useFloorStore((state) => state.wallet);
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
  // Recordings always show every panel and never the first-visit guide.
  const full = recordMode || prefs.view === "full";
  const tab = !full && (mobileTab === "Seats" || mobileTab === "Log") ? "Trade" : mobileTab;
  const joinedNow = tutorial && Boolean(view.mine);
  const firstVisit = prefs.loaded && !prefs.guideSeen && !recordMode;
  const guideOpen = !touring && (guideAsked || joinedNow || firstVisit);
  const closeGuide = () => {
    setGuideAsked(false);
    markGuideSeen();
    if (useFloorStore.getState().tutorial) updateFloor({ tutorial: false });
  };
  const startTour = () => {
    closeGuide();
    setTouring(true);
  };
  const xrayHref = fixtureMode ? "/xray?fixture=1" : "/xray";
  const walletReady = identity === "wallet" && Boolean(wallet);
  const seatOpen = seatAvailable(snapshot);
  const { standardDelay, priorityDelay, priorityFee } = snapshot.table.params;
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
      <FloorHud
        config={config}
        view={view}
        status={status}
        result={myScore ?? undefined}
        counting={view.phase === "xray" && !finalized}
      />
      <PhaseBanner
        key={`${view.round}-${view.phase}`}
        round={view.round}
        phase={view.phase}
        fixture={fixtureMode}
      />
      <NextStepBar
        config={config}
        view={view}
        result={myScore ?? undefined}
        wallet={walletReady}
        seatOpen={seatOpen}
        xrayHref={xrayHref}
        floorView={full ? "full" : "simple"}
        onGo={goTo}
        onGuide={() => setGuideAsked(true)}
        onTour={() => setTouring(true)}
      />

      {view.phase === "xray" && (
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? reducedTransition : spring}
          className="studio-stage mb-3 flex flex-wrap items-center gap-4 px-4 py-3"
          aria-label="Round summary"
        >
          {top.length > 0 && (
            <div aria-hidden className="flex items-end">
              {[top[1], top[0], top[2]].map(
                (seat) =>
                  seat && (
                    <span key={seat.index} className="-mx-1">
                      <Capsule
                        size={seat === top[0] ? 62 : 46}
                        topColor={seatColor(seat.index, finalMine?.index)}
                        mine={seat.index === finalMine?.index}
                        motion="drop"
                        decorative
                      />
                    </span>
                  ),
              )}
            </div>
          )}
          <div className="min-w-0">
            <Stamp className="text-priority">Round complete</Stamp>
            <p className="mt-2.5 text-lg leading-6 font-black">
              {!finalized
                ? "Counting the scores…"
                : finalMine && myRank
                  ? `You finished ${ordinal(myRank)} of ${ranked.length} with ${signed(myScore ?? 0)} chips`
                  : ranked.length
                    ? "You watched this round"
                    : "No occupied seats this round."}
            </p>
            {top.length > 0 && (
              <p className="mt-1 text-sm font-extrabold">
                Top players:{" "}
                {top.map((seat) => `${seat.name} ${signed(seat.score ?? 0)}`).join(" · ")}
              </p>
            )}
            {finalized && (
              <p className="text-muted mt-1 text-xs font-bold">
                Sandwiches this round (trading just before and after someone&apos;s order):{" "}
                {finalized.tagCount}
                {finalMine && ` · by you: ${myFrontRuns} · on you: ${myVictimizations}`}
              </p>
            )}
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
      <div
        className={cn(
          "floor-grid grid grid-cols-1 gap-3",
          full
            ? "min-[1440px]:flex-1 min-[1440px]:grid-rows-[minmax(480px,1fr)_auto] lg:grid-cols-[210px_minmax(0,1fr)_270px] xl:grid-cols-[220px_minmax(0,1fr)_290px]"
            : "floor-simple lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-start",
        )}
      >
        <div
          data-tour="players"
          className={cn("floor-seats", full ? tab !== "Seats" && "hidden md:block" : "hidden")}
        >
          <SeatRail view={view} />
        </div>
        <div
          className={cn(
            "floor-chart flex flex-col gap-3",
            full ? "min-h-[400px] min-[1440px]:min-h-0" : "lg:col-start-1 lg:row-start-1",
            tab !== "Trade" && "hidden md:flex",
          )}
        >
          <div data-tour="chart" className={cn(full && "min-h-[280px] min-[1440px]:flex-1")}>
            <PriceChart view={view} vaults={vaults} />
          </div>
          <div data-tour="lanes" className={cn(!full && "hidden")}>
            <MempoolLanes snapshot={snapshot} view={view} />
          </div>
        </div>
        <aside
          className={cn(
            "floor-aside space-y-3",
            full
              ? "min-[1440px]:h-full min-[1440px]:overflow-y-auto lg:row-span-2 lg:min-h-0 lg:max-[1439px]:h-0"
              : "lg:col-start-2 lg:row-span-2 lg:row-start-1",
            tab !== "Trade" && tab !== "Log" && "hidden md:block",
          )}
        >
          <div
            data-tour="trade"
            className={cn(
              "floor-ticket rounded-[22px]",
              spot === "trade" && "attention",
              tab !== "Trade" && "hidden md:block",
            )}
          >
            <OrderPanel config={config} snapshot={snapshot} view={view} simple={!full} />
          </div>
          <div
            data-tour="log"
            className={cn("floor-tape", full ? tab !== "Log" && "hidden md:block" : "hidden")}
          >
            <Feed
              view={view}
              snapshot={snapshot}
              player={player}
              onPrefill={() => setMobileTab("Trade")}
            />
          </div>
        </aside>
        <div
          data-tour="capsules"
          className={cn(
            "floor-leaks rounded-[22px]",
            full ? "lg:col-span-2" : "lg:col-start-1 lg:row-start-2",
            spot === "capsules" && "attention",
            tab !== "Capsules" && "hidden md:block",
          )}
        >
          <LeakBoard config={config} view={view} vaults={vaults} snapshot={snapshot} />
        </div>
      </div>
      <nav
        aria-label="Floor panels"
        className={cn(
          "floor-tabs border-primary bg-surface fixed right-0 bottom-0 left-0 z-30 grid gap-1 border-t-[3px] px-1 pb-[env(safe-area-inset-bottom)] md:hidden",
          full ? "grid-cols-4" : "grid-cols-2",
        )}
      >
        {(full
          ? (["Trade", "Capsules", "Seats", "Log"] as const)
          : (["Trade", "Capsules"] as const)
        ).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setMobileTab(item)}
            className={cn(
              "my-1 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-extrabold",
              tab === item ? "bg-primary text-white" : "text-muted",
            )}
          >
            <TabIcon tab={item} />
            {item}
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
      {guideOpen && (
        <GuideDialog
          lanes={{
            standard: (standardDelay * TICK_MILLIS) / 1000,
            priority: (priorityDelay * TICK_MILLIS) / 1000,
            fee: priorityFee,
          }}
          seatName={view.mine?.name}
          seatNumber={view.mine ? view.mine.index + 1 : undefined}
          welcome={joinedNow && prefs.guideSeen && !guideAsked}
          joining={joining}
          wallet={walletReady}
          seatOpen={seatOpen}
          onJoin={() => void (walletReady ? takeSeat() : joinAsGuest())}
          onTour={startTour}
          onClose={closeGuide}
        />
      )}
      {touring && (
        <FloorTour stops={tourStops(full)} onTab={setMobileTab} onClose={() => setTouring(false)} />
      )}
    </main>
  );
}

function TabIcon({ tab }: { tab: keyof typeof tabIcons }) {
  const Icon = tabIcons[tab];
  return <Icon aria-hidden className="size-4" />;
}
