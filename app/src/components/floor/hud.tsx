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
    <div className="floor-hud border-line bg-surface sticky top-14 z-20 mb-3 grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-3 md:static md:flex md:flex-wrap md:gap-5 md:px-4">
      <div className="min-w-0">
        <div className="micro-label">Arena / round {String(view.round).padStart(2, "0")}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
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
          {status === "fixture" && <Badge tone="opened">Fixture</Badge>}
          {status === "reconnecting" && <Badge tone="neutral">Reconnecting</Badge>}
        </div>
      </div>
      <Screen className="min-w-24 px-3 py-1.5 text-center">
        <div className="micro-label">Phase / seconds</div>
        <Readout
          value={view.secondsLeft}
          format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
          className="text-3xl font-black"
        />
      </Screen>
      <PhaseBar tick={view.tick} className="col-span-2 w-full md:w-44 md:flex-1" />
      {view.mine && (
        <div className="border-line min-w-0 border-l pl-3">
          <div className="micro-label">Your seat / {view.mine.name}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 font-mono text-xs">
            <Readout value={view.mine.chips} className="text-xl font-bold" />
            <span className="text-muted">CHIPS</span>
            <Num value={view.mine.pnl} kind="delta" />
          </div>
        </div>
      )}
      <div id="join-seat" className="col-span-2 md:ml-auto">
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
      className="phase-banner border-ink bg-capsule mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border-2 px-4 py-3 text-[#161513]"
      role="status"
    >
      <strong className="font-mono text-sm uppercase">
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
