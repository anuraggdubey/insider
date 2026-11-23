"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/ui/countdown";
import { Divider } from "@/components/ui/divider";
import { GlowBorder } from "@/components/ui/glow-border";
import { Kbd } from "@/components/ui/kbd";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { PhaseBar } from "@/components/ui/phase-bar";
import { SealedCard } from "@/components/ui/sealed-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticker } from "@/components/ui/ticker";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

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
];
export function Showcase() {
  const toast = useToast((state) => state.add);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-16 sm:px-8">
      <div>
        <p className="micro-label text-sealed">Development only</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight">Terminal components</h1>
        <p className="text-muted mt-3 text-sm">
          A reference for interface states. All values are illustrative.
        </p>
      </div>
      <Panel title="Buttons" label="Variants & sizes">
        <div className="flex flex-wrap gap-3 p-5">
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="buy">Buy</Button>
          <Button variant="sell">Sell</Button>
          <Button variant="priority">Priority</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Panel>
      <Panel title="Signals" label="Badges, numerals & keys">
        <div className="space-y-6 p-5">
          <div className="flex flex-wrap gap-2">
            {tones.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
          <Divider />
          <div className="flex flex-wrap items-center gap-8">
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
              <Num kind="delta" value={21.5} /> <Num kind="delta" value={-9} />
            </div>
            <Tooltip content="An example keyboard shortcut">
              <Kbd>⌘ K</Kbd>
            </Tooltip>
          </div>
          <Countdown ticks={14} totalTicks={24} />
          <PhaseBar tick={169} />
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <SealedCard kind="Flow window" rarity="common" state="sealed" price={8} />
        <SealedCard kind="Whale" rarity="rare" state="opened" price={20} />
        <SealedCard kind="Full book" rarity="epic" state="sealed" price={60} />
      </div>
      <GlowBorder>
        <div className="p-5">
          <p className="micro-label">Moving border</p>
          <p className="mt-2 text-sm">A little light for the moments that matter.</p>
        </div>
      </GlowBorder>
      <Ticker
        events={[
          "Example: a seat sends an order",
          "Example: a leak is listed",
          "Illustrative only",
        ]}
      />
      <Panel title="Feedback">
        <div className="space-y-4 p-5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-full" />
          <Button variant="outline" onClick={() => toast("Example notification")}>
            Show toast
          </Button>
        </div>
      </Panel>
    </main>
  );
}
