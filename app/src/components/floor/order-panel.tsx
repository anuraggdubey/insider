"use client";

import type { InsiderConfig, TableSnapshot, TableView } from "@insider/sdk";
import { TICK_MILLIS } from "@insider/sdk/constants";
import { previewOrder } from "@insider/sdk/vamm";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { FastModeToggle } from "@/components/onboarding/wallet";
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
import { seatAvailable, seconds, signed } from "@/lib/onboarding";
import { playSound } from "@/lib/sound";

export function OrderPanel({
  config,
  snapshot,
  view,
  simple = false,
}: {
  config: InsiderConfig;
  snapshot: TableSnapshot;
  view: TableView;
  /** The simple floor view keeps the price details folded away. */
  simple?: boolean;
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

  const seatOpen = Boolean(view.mine) || seatAvailable(snapshot);
  // Explains a disabled Send button. Display only: `canSend` above is still the gate.
  const blocker = !view.mine
    ? seatOpen
      ? "Join at the top of the floor to start trading"
      : "Every seat is busy. You can watch for now"
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
        document.querySelector('[aria-modal="true"]') ||
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

  return (
    <Panel
      title="Make a trade"
      action={
        <span className="micro-label">
          {pendingCount}/{params.maxPending} on the way
        </span>
      }
    >
      <div className="space-y-4 p-3">
        {view.mine && (view.phase === "live" || view.phase === "closing") && (
          <div
            data-testid="position-summary"
            className="border-line bg-surface-2 flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2"
          >
            <span className="text-xs leading-4 font-extrabold">
              {view.mine.position === 0 ? (
                "No bet open yet"
              ) : (
                <>
                  Betting the price goes {view.mine.position > 0 ? "up" : "down"}
                  <span className="text-muted block font-bold">
                    {view.mine.position > 0 ? "Bought" : "Sold"}{" "}
                    {Math.abs(view.mine.position).toLocaleString("en-US")} units
                  </span>
                </>
              )}
            </span>
            <span className="text-right">
              <span className="micro-label block">Score now</span>
              <span
                className={cn(
                  "font-mono text-lg font-black tabular-nums",
                  view.mine.pnl > 0 && "text-buy",
                  view.mine.pnl < 0 && "text-sell",
                )}
              >
                {signed(view.mine.pnl)}
              </span>
            </span>
          </div>
        )}
        <div>
          <span className="micro-label mb-2 block">1 · Which way?</span>
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as const).map((value) => (
              <Button
                key={value}
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
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="order-size" className="micro-label">
              2 · How much? (units)
            </label>
            <span className="text-muted font-mono text-[11px] font-bold">
              MAX {max.toLocaleString()}
            </span>
          </div>
          <Stepper
            id="order-size"
            label="Order size"
            value={effectiveSize}
            max={Math.floor(max / 50) * 50}
            onChange={(value) => setSize(Math.floor(value / 50) * 50)}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="micro-label">3 · How fast?</span>
            <Kbd className="hidden sm:inline">P</Kbd>
          </div>
          <Switch
            label="Priority lane"
            className={cn(
              "w-full",
              lane === 1 && "[--switch-ink:#0d1633] [--switch-thumb:var(--color-signal)]",
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
        </div>
        <details
          open={!simple}
          className="border-line bg-surface-2 text-muted rounded-xl border-2 px-3 py-2 text-xs font-bold"
        >
          <summary className="cursor-pointer">Price details</summary>
          <div className="space-y-1.5 pt-2 pb-0.5">
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
          <p className="text-faint pt-1 text-[11px] leading-4">
            Price impact is how far your own order moves the price.
          </p>
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
          {view.mine ? `Send ${side} order` : seatOpen ? "Join the game to trade" : "Watching only"}{" "}
          <Kbd className="border-current/20 bg-transparent text-inherit">↵</Kbd>
        </Button>
        <div className="text-center text-[11px] leading-5 font-bold">
          {blocker ? (
            <p className="text-priority">
              {view.mine || !seatOpen ? (
                blocker
              ) : (
                <a href="#join-seat" className="underline underline-offset-4">
                  {blocker} ↑
                </a>
              )}
            </p>
          ) : (
            <p className="text-muted">Side and size stay private until your order fills.</p>
          )}
          <p className="text-faint hidden md:block">Keys: B buy · S sell · P speed · Enter send</p>
        </div>
        {view.myPending.length > 0 && (
          <ul aria-label="Your orders on the way" className="space-y-1.5">
            {view.myPending.map((order) => (
              <li
                key={order.id}
                className="border-line flex items-center justify-between gap-2 rounded-xl border-2 border-dashed px-3 py-1.5 text-xs font-extrabold"
              >
                <span className={order.sideSize > 0 ? "text-buy" : "text-sell"}>
                  {order.sideSize > 0 ? "BUY" : "SELL"} {Math.abs(order.sideSize)}
                </span>
                <span className="text-muted">lands in {seconds(order.ticksToLand)}</span>
              </li>
            ))}
          </ul>
        )}
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
