"use client";

import type { InsiderConfig, TableSnapshot, TableView } from "@insider/sdk";
import { TICK_MILLIS } from "@insider/sdk/constants";
import { previewOrder } from "@insider/sdk/vamm";
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { useJoin } from "@/components/onboarding/guest";
import { FastModeToggle, WalletPlayButton } from "@/components/onboarding/wallet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { friendlyError } from "@/lib/errors";
import { useFloorStore } from "@/lib/floor-store";
import { playSound } from "@/lib/sound";

export function OrderPanel({
  config,
  snapshot,
  view,
}: {
  config: InsiderConfig;
  snapshot: TableSnapshot;
  view: TableView;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lane, setLane] = useState(0);
  const [size, setSize] = useState(250);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const draft = useFloorStore((state) => state.orderDraft);
  const params = snapshot.table.params;
  const pendingUnits = view.myPending.reduce((sum, order) => sum + order.sideSize, 0);
  const projected = (view.mine?.position ?? 0) + pendingUnits;
  const max = Math.max(
    0,
    Math.min(
      params.maxOrderUnits,
      side === "buy" ? params.maxPositionUnits - projected : params.maxPositionUnits + projected,
    ),
  );
  const effectiveSize = Math.floor(Math.min(size, max) / 50) * 50;
  const pendingCount = Math.max(
    snapshot.seats.find((seat) => seat.index === view.mine?.index)?.pendingCount ?? 0,
    view.myPending.length,
  );
  const pendingFull = pendingCount >= params.maxPending;
  const canSend = Boolean(
    view.mine && view.phase === "live" && effectiveSize && !view.mine.liquidated && !pendingFull,
  );

  // Explains a disabled Send button. Display only: `canSend` above is still the gate.
  const blocker = !view.mine
    ? "Take a seat to start trading"
    : view.mine.liquidated
      ? "You ran out of chips this round"
      : view.phase !== "live"
        ? view.phase === "closing"
          ? "Orders are closed for this round"
          : "Orders open when the next round goes live"
        : pendingFull
          ? "Pending order limit reached"
          : !effectiveSize
            ? max
              ? "Pick a size above 0"
              : "Position limit reached on this side"
            : null;

  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      setSide(draft.side);
      setSize(draft.size);
    }, 0);
    return () => clearTimeout(timer);
  }, [draft]);

  const quote = useMemo(() => {
    if (!effectiveSize) return null;
    try {
      return previewOrder(
        {
          base: BigInt(snapshot.market.base.toString()),
          quote: BigInt(snapshot.market.quote.toString()),
        },
        (side === "buy" ? 1 : -1) * effectiveSize,
        params,
      );
    } catch {
      return null;
    }
  }, [snapshot.market.base, snapshot.market.quote, params, side, effectiveSize]);

  const send = useCallback(async () => {
    if (busy || !canSend) return;
    setBusy(true);
    try {
      const { submitOrder } = await import("@/lib/floor-actions");
      await submitOrder(config, (side === "buy" ? 1 : -1) * effectiveSize, lane);
      playSound(lane === 1 ? "priority" : "order");
      const delay = lane ? params.priorityDelay : params.standardDelay;
      useToast
        .getState()
        .add(
          `SENT · ${lane ? "PRIORITY" : "STANDARD"} · lands in ${((delay * TICK_MILLIS) / 1000).toFixed(1)}s`,
        );
    } catch (error) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      useToast.getState().add(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    canSend,
    config,
    effectiveSize,
    lane,
    side,
    params.priorityDelay,
    params.standardDelay,
  ]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, button, a, [role=button], [role=dialog]") ||
        target?.isContentEditable ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "b") setSide("buy");
      if (key === "s") setSide("sell");
      if (key === "p") setLane((value) => (value === 0 ? 1 : 0));
      if (key === "enter") void send();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [send]);

  if (!view.mine) return <JoinCard config={config} />;

  return (
    <Panel
      id="action-pad"
      title="Buy or Sell"
      action={
        <span className="micro-label" title="Orders waiting to land">
          {pendingCount}/{params.maxPending} waiting
        </span>
      }
    >
      <div className="space-y-4 p-3">
        <p className="text-muted text-xs leading-5 font-bold">
          Think the price goes up? Buy. Down? Sell. You score when you&apos;re right.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["buy", "sell"] as const).map((value) => (
            <Button
              key={value}
              data-spot-focus={value === "buy" ? "" : undefined}
              variant={side === value ? value : "outline"}
              aria-pressed={side === value}
              onClick={() => setSide(value)}
              className="min-h-16 px-2"
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1.5 text-lg font-bold">
                  {value === "buy" ? (
                    <ArrowUpRight aria-hidden className="size-4" />
                  ) : (
                    <ArrowDownLeft aria-hidden className="size-4" />
                  )}
                  {value.toUpperCase()}
                </span>
                <span className="font-[family-name:var(--font-body)] text-[11px] font-extrabold whitespace-nowrap">
                  {value === "buy" ? "Price goes up" : "Price goes down"}
                </span>
              </span>
              <Kbd className="absolute top-1 right-1 hidden border-current/30 bg-transparent px-1 py-0 text-[9px] text-inherit sm:block">
                {value[0]!.toUpperCase()}
              </Kbd>
            </Button>
          ))}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="order-size" className="micro-label">
              How much (units)
            </label>
            <span className="text-muted font-mono text-[11px] font-bold">
              MAX {max.toLocaleString()}
            </span>
          </div>
          <Stepper
            id="order-size"
            label="Size / units"
            value={effectiveSize}
            max={Math.floor(max / 50) * 50}
            onChange={(value) => setSize(Math.floor(value / 50) * 50)}
          />
        </div>
        <details className="group border-line rounded-xl border-2">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-extrabold">
            <span>
              Speed:{" "}
              <span className={lane ? "text-priority" : "text-muted"}>
                {lane
                  ? `Priority, ${(params.priorityDelay * TICK_MILLIS) / 1000}s`
                  : `Standard, ${(params.standardDelay * TICK_MILLIS) / 1000}s`}
              </span>
            </span>
            <span className="text-muted flex items-center gap-1">
              More options
              <ChevronDown
                aria-hidden
                className="size-3.5 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="space-y-3 px-3 pb-3">
            <p className="text-muted text-[11px] leading-4 font-bold">
              Every order waits hidden before it lands. Priority lands sooner for a small fee: use
              it to get in ahead of an order you know about.
            </p>
            <div className="flex items-center justify-between">
              <span className="micro-label">Speed lane</span>
              <Kbd>P</Kbd>
            </div>
            <Switch
              label="Priority lane"
              className={cn(
                "w-full",
                lane === 1 && "[--switch-ink:#0f1f5c] [--switch-thumb:var(--color-signal)]",
              )}
              checked={lane === 1}
              onCheckedChange={(checked) => setLane(checked ? 1 : 0)}
              off={
                <span>
                  Standard
                  <br />
                  {(params.standardDelay * TICK_MILLIS) / 1000}s · free
                </span>
              }
              on={
                <span>
                  Priority
                  <br />
                  {(params.priorityDelay * TICK_MILLIS) / 1000}s · {params.priorityFee} chips
                </span>
              }
            />
            <div className="border-line bg-surface-2 text-muted space-y-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold">
              <div className="flex justify-between">
                <span>Average price</span>
                <span className="text-ink font-mono">
                  {quote ? (quote.avgPrice / 1_000_000).toFixed(4) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Price impact</span>
                <span className="text-ink font-mono">
                  {quote ? `${(quote.impactBps / 100).toFixed(2)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated fee</span>
                <span className="text-ink font-mono">
                  {quote
                    ? `${(quote.fee + BigInt(lane ? params.priorityFee : 0)).toString()} chips`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </details>
        <Button
          variant={side}
          onClick={() => void send()}
          loading={busy}
          shake={shake}
          disabled={!canSend}
          size="lg"
          className="w-full text-lg"
        >
          {`Send ${side}`} <Kbd className="border-current/20 bg-transparent text-inherit">↵</Kbd>
        </Button>
        <div className="text-center text-[11px] leading-5 font-bold">
          {blocker ? (
            <p className="text-priority">{blocker}</p>
          ) : (
            <p className="text-muted">Nobody can see your order until it lands.</p>
          )}
          <p className="text-faint hidden md:block">Keys: B buy · S sell · P lane · Enter send</p>
        </div>
        <FastModeToggle walletOnly />
        <div className="border-line bg-surface fixed right-0 bottom-[3.75rem] left-0 z-20 flex items-center justify-between gap-3 border-t-2 px-4 py-2 md:hidden">
          <span className="min-w-0 font-mono text-[10px]">
            <strong className={side === "buy" ? "text-buy" : "text-sell"}>
              {side.toUpperCase()} {effectiveSize}
            </strong>
            <span className="text-muted block">
              {lane ? "PRIORITY" : "STANDARD"} ·{" "}
              {((lane ? params.priorityDelay : params.standardDelay) * TICK_MILLIS) / 1000}s
            </span>
          </span>
          <Button
            variant={side}
            size="sm"
            aria-label={`Send order, quick ${side}`}
            onClick={() => void send()}
            loading={busy}
            disabled={!canSend}
          >
            Send order <span aria-hidden="true">↵</span>
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Shown instead of the order ticket until the visitor has a seat. */
function JoinCard({ config }: { config: InsiderConfig }) {
  const { busy, joinAsGuest, joinFloor } = useJoin(config);
  return (
    <Panel id="action-pad" title="Buy or Sell">
      <div className="space-y-4 p-4">
        <div>
          <div className="text-ink text-base font-extrabold">You&apos;re watching</div>
          <p className="text-muted mt-1 text-xs leading-5 font-bold">
            Sit down to trade. You get 1,000 play chips: buy if you think the price goes up, sell if
            you think it goes down.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full"
          data-spot-focus=""
          loading={busy}
          onClick={() => void joinAsGuest()}
        >
          Take a free seat
        </Button>
        <div className="space-y-1.5">
          <div className="[&>button]:w-full">
            <WalletPlayButton size="sm" onReady={joinFloor} />
          </div>
          <p className="text-faint text-center text-[11px] font-bold">
            No wallet needed for a free seat.
          </p>
        </div>
      </div>
    </Panel>
  );
}
