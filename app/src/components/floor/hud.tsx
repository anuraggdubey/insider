"use client";

import type { InsiderConfig, TableView } from "@insider/sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GuestControls } from "@/components/onboarding/guest";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Num } from "@/components/ui/num";
import { PhaseBar } from "@/components/ui/phase-bar";
import { Readout } from "@/components/ui/readout";
import { Screen } from "@/components/ui/screen";

export function FloorHud({
  config,
  view,
  status,
}: {
  config: InsiderConfig;
  view: TableView;
  status: string;
}) {
  const phase = view.phase === "xray" ? "X-RAY" : view.phase.toUpperCase();
  return (
    <div className="floor-hud border-line bg-surface sticky top-14 z-20 mb-3 grid shrink-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border p-2 md:static md:flex md:flex-wrap md:gap-5 md:px-4 md:py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink font-[family-name:var(--font-display)] text-lg leading-none font-bold md:text-2xl">
            Round {String(view.round).padStart(2, "0")}
          </span>
          <Badge
            tone={
              view.phase === "live"
                ? "live"
                : view.phase === "xray"
                  ? "opened"
                  : view.phase === "closing"
                    ? "priority"
                    : "neutral"
            }
          >
            {phase}
          </Badge>
          {status === "fixture" && (
            <>
              <Badge tone="opened" className="hidden md:inline-flex">
                Fixture
              </Badge>
              <span className="text-opened font-mono text-[9px] font-bold md:hidden">
                <span aria-hidden="true">FIX</span>
                <span className="sr-only">Fixture</span>
              </span>
            </>
          )}
          {status === "reconnecting" && (
            <>
              <Badge tone="neutral" className="hidden md:inline-flex">
                Reconnecting
              </Badge>
              <span className="text-muted font-mono text-[9px] font-bold md:hidden">RETRY</span>
            </>
          )}
        </div>
      </div>
      <Screen className="min-w-20 px-2 py-1 text-center md:min-w-24 md:px-3 md:py-1.5">
        <div className="micro-label hidden md:block">Seconds left</div>
        <span className="led-readout text-xl font-black tabular-nums md:text-3xl">
          {view.secondsLeft.toFixed(1)}
        </span>
      </Screen>
      <PhaseBar tick={view.tick} className="hidden md:block md:w-56 md:min-w-56 md:flex-1" />
      {view.mine && (
        <div className="border-line min-w-0 md:border-l md:pl-3">
          <div className="micro-label truncate">You are {view.mine.name}</div>
          <div className="flex flex-wrap items-baseline gap-2 font-mono text-xs md:mt-1">
            <Readout value={view.mine.chips} className="text-base font-bold md:text-xl" />
            <span className="text-muted">CHIPS</span>
            <Num value={view.mine.pnl} kind="delta" />
          </div>
        </div>
      )}
      <div
        id="join-seat"
        className={view.mine ? "justify-self-end md:ml-auto" : "col-span-2 md:ml-auto"}
      >
        <GuestControls config={config} view={view} />
      </div>
    </div>
  );
}

export function PhaseBanner({
  round,
  phase,
  fixture,
}: {
  round: number;
  phase: string;
  fixture: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, []);
  if (!visible || !["live", "closing", "xray"].includes(phase)) return null;
  return (
    <div
      className="phase-banner bg-capsule mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-full px-6 py-3 text-[#1d1600] shadow-[0_5px_0_#b87a00]"
      role="status"
    >
      <strong className="font-[family-name:var(--font-display)] text-xl font-bold uppercase">
        {phase === "live"
          ? `ROUND ${round} · LIVE`
          : phase === "closing"
            ? "CLOSING · ORDERS STOP"
            : "X-RAY · EVERYTHING REVEALED"}
      </strong>
      {phase === "xray" && (
        <Link
          href={fixture ? "/xray?fixture=1" : "/xray"}
          className={buttonStyles({ variant: "ink", size: "sm" })}
          prefetch={false}
        >
          Open X-ray
        </Link>
      )}
    </div>
  );
}
