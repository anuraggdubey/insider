"use client";

import { useEffect, useMemo, useState } from "react";
import { createConfig } from "@insider/sdk/config";
import dynamic from "next/dynamic";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Capsule, type CapsuleRarity, type CapsuleState } from "@/components/ui/capsule";
import { Countdown } from "@/components/ui/countdown";
import { Divider } from "@/components/ui/divider";
import { Kbd } from "@/components/ui/kbd";
import { MainNav } from "@/components/ui/main-nav";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { PhaseBar } from "@/components/ui/phase-bar";
import { Readout } from "@/components/ui/readout";
import { Screen } from "@/components/ui/screen";
import { SealedCard } from "@/components/ui/sealed-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stamp } from "@/components/ui/stamp";
import { Empty, ErrorState } from "@/components/ui/states";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Ticker } from "@/components/ui/ticker";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import type { CupData, CupStatus } from "@/lib/cup";

const CupJoinCard = dynamic(() => import("@/components/cup/cup-join-card"));

const tones: BadgeTone[] = [
  "neutral",
  "sealed",
  "opened",
  "buy",
  "sell",
  "priority",
  "common",
  "rare",
  "epic",
  "whale",
  "flow",
  "fundamentals",
  "live",
];
const rarities: CapsuleRarity[] = ["common", "rare", "epic"];
const states: CapsuleState[] = ["sealed", "owned", "listed", "opened", "expired"];

export function Showcase() {
  const toast = useToast((state) => state.add);
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState(500);
  const [number, setNumber] = useState(1000);
  const [shake, setShake] = useState(false);
  const config = useMemo(() => createConfig(), []);
  const [cup, setCup] = useState<{ cup: CupData; operator: CupStatus } | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production")
      void import("@/lib/cup-fixture").then(({ fixtureCup }) => setCup(fixtureCup(false)));
  }, []);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 py-16 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro-label text-brand">Development only / component catalogue</p>
          <h1 className="mt-3 text-4xl sm:text-6xl">The machine kit.</h1>
          <p className="text-muted mt-3 text-sm">
            Every state in light and dark. Switch the theme to inspect both.
          </p>
        </div>
        <ThemeToggle />
      </div>
      <Panel title="Keys / every variant" label="hover · press · focus">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Button>Primary</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="buy">Buy</Button>
          <Button variant="sell">Sell</Button>
          <Button variant="priority">Priority</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button
            shake={shake}
            onClick={() => {
              setShake(true);
              setTimeout(() => setShake(false), 300);
            }}
          >
            Error shake
          </Button>
        </div>
      </Panel>
      <Panel title="Capsules / rarity × state" label="hover to wobble">
        <div className="space-y-6 p-5">
          {rarities.map((rarity) => (
            <div key={rarity}>
              <p className="micro-label mb-4">{rarity}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {states.map((state) => (
                  <div
                    key={state}
                    className="bg-surface-2 flex flex-col items-center rounded-xl p-3"
                  >
                    <Capsule
                      rarity={rarity}
                      state={state}
                      motion={state === "owned" ? "pop" : "drop"}
                      mine={state === "owned"}
                      label={state}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Signals / badges · numerals · keys">
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {tones.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
          <Divider />
          <div className="flex flex-wrap items-center gap-7">
            <div>
              <p className="micro-label">Chips</p>
              <Num value={12345} />
            </div>
            <div>
              <p className="micro-label">Price</p>
              <Num kind="price" value={1042500} />
            </div>
            <div>
              <p className="micro-label">Delta</p>
              <Num kind="delta" value={21.5} /> / <Num kind="delta" value={-9} />
            </div>
            <Tooltip content="An example keyboard shortcut">
              <Kbd>Enter</Kbd>
            </Tooltip>
          </div>
          <Countdown ticks={14} totalTicks={24} />
          <PhaseBar tick={169} />
        </div>
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Screen label="Readout / change">
          <div className="space-y-5 p-5">
            <Readout value={number} className="text-4xl" />
            <div className="flex gap-3">
              <Button size="sm" onClick={() => setNumber(number + 25)}>
                +25
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNumber(number - 25)}>
                −25
              </Button>
            </div>
          </div>
        </Screen>
        <Panel title="Controls / lane · order size">
          <div className="space-y-5 p-5">
            <Switch
              checked={checked}
              onCheckedChange={setChecked}
              label="Priority lane"
              off="Standard 10s · free"
              on="Priority 2s · 3"
            />
            <Stepper value={value} onChange={setValue} />
          </div>
        </Panel>
      </div>
      <Panel title="Stamps / feedback">
        <div className="flex flex-wrap items-center gap-5 p-6">
          {["FILLED", "FRONT-RUN +412", "SANDWICHED", "HIT", "MISS", "VERIFIED"].map((label) => (
            <Stamp key={label}>{label}</Stamp>
          ))}
          <Button variant="outline" onClick={() => toast("Filled · priority")}>
            Show toast
          </Button>
        </div>
      </Panel>
      {cup && (
        <CupJoinCard config={config} status={cup.operator} cup={cup.cup} operatorUrl="" fixture />
      )}
      <Panel title="Channel switch">
        <div className="p-5">
          <MainNav
            items={[
              ["Floor", "/table"],
              ["Desk", "/desk"],
              ["Cup", "/cup"],
              ["Season", "/season"],
              ["Proof", "/proof"],
            ]}
          />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <SealedCard kind="Flow window" rarity="common" state="sealed" price={8} />
        <SealedCard kind="Whale" rarity="rare" state="opened" price={20} />
        <SealedCard kind="Full book" rarity="epic" state="sealed" price={60} />
      </div>
      <Ticker events={["A seat sends an order", "A capsule is listed", "Illustrative only"]} />
      <Panel title="Loading · empty · error">
        <div className="space-y-4 p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full" />
          <Empty
            action={
              <Button variant="outline" size="sm">
                Explore
              </Button>
            }
          >
            No capsules yet. The first one drops at 0:05.
          </Empty>
          <ErrorState
            retry={
              <Button variant="outline" size="sm">
                Retry
              </Button>
            }
          >
            Could not connect to the table.
          </ErrorState>
        </div>
      </Panel>
    </main>
  );
}
