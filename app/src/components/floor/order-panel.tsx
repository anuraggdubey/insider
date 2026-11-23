"use client";

import type { InsiderConfig, TableSnapshot, TableView } from "@insider/sdk";
import { TICK_MILLIS } from "@insider/sdk/constants";
import { previewOrder } from "@insider/sdk/vamm";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { friendlyError } from "@/lib/errors";
import { useFloorStore } from "@/lib/floor-store";
import { reducedTransition, spring } from "@/lib/motion";
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
  const [sizeInput, setSizeInput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = useFloorStore((state) => state.orderDraft);
  const reducedMotion = useReducedMotion();
  const pendingUnits = view.myPending.reduce((sum, order) => sum + order.sideSize, 0);
  const projected = (view.mine?.position ?? 0) + pendingUnits;
  const max = Math.max(
    0,
    Math.min(
      snapshot.table.params.maxOrderUnits,
      side === "buy"
        ? snapshot.table.params.maxPositionUnits - projected
        : snapshot.table.params.maxPositionUnits + projected,
    ),
  );
  const effectiveSize = Math.min(size, Math.floor(max / 50) * 50);
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
        snapshot.table.params,
      );
    } catch {
      return null;
    }
  }, [snapshot.market.base, snapshot.market.quote, snapshot.table.params, side, effectiveSize]);
  const send = useCallback(async () => {
    if (busy || !view.mine || view.phase !== "live" || !effectiveSize || view.mine.liquidated)
      return;
    setBusy(true);
    try {
      const { submitOrder } = await import("@/lib/floor-actions");
      await submitOrder(config, (side === "buy" ? 1 : -1) * effectiveSize, lane);
      playSound(lane === 1 ? "priority" : "order");
    } catch (error) {
      useToast.getState().add(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }, [busy, config, effectiveSize, lane, side, view.mine, view.phase]);

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

  return (
    <div className="space-y-3">
      <Panel title="Order ticket" action={<span className="micro-label">Sealed</span>}>
        <div className="space-y-3 p-3">
          <div className="bg-bg grid grid-cols-2 gap-1 rounded-md p-1">
            {(["buy", "sell"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => setSide(value)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded font-mono text-[11px] uppercase transition-colors",
                  side === value
                    ? value === "buy"
                      ? "bg-buy/15 text-buy"
                      : "bg-sell/15 text-sell"
                    : "text-faint hover:text-muted",
                )}
              >
                {value === "buy" ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownLeft className="size-3" />
                )}
                {value} <Kbd className="ml-1 text-[9px]">{value[0]!.toUpperCase()}</Kbd>
              </button>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="order-size" className="micro-label">
                Size / units
              </label>
              <span className="text-faint font-mono text-[9px]">MAX {max.toLocaleString()}</span>
            </div>
            <div className="border-line-strong bg-bg mt-1 flex h-9 items-center rounded border px-2.5">
              <input
                id="order-size"
                type="number"
                min={0}
                max={max}
                step={50}
                value={sizeInput ?? effectiveSize}
                onFocus={() => setSizeInput(String(effectiveSize))}
                onBlur={() => setSizeInput(null)}
                onChange={(event) => {
                  setSizeInput(event.target.value);
                  setSize(
                    Math.max(0, Math.min(max, Math.round(Number(event.target.value) / 50) * 50)),
                  );
                }}
                className="text-text w-full bg-transparent font-mono text-sm outline-none"
              />
              <span className="text-faint font-mono text-[9px]">UNITS</span>
            </div>
            <input
              aria-label="Order size slider"
              type="range"
              min={0}
              max={Math.max(0, Math.floor(max / 50) * 50)}
              step={50}
              value={effectiveSize}
              onChange={(event) => setSize(Number(event.target.value))}
              className="accent-sealed mt-2 h-1 w-full cursor-pointer"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="micro-label">Execution lane</span>
              <Kbd className="text-[9px]">P</Kbd>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                aria-pressed={lane === 0}
                onClick={() => setLane(0)}
                className={cn(
                  "rounded border px-2 py-1.5 text-left",
                  lane === 0 ? "border-sealed/50 bg-sealed/8" : "border-line bg-bg",
                )}
              >
                <span className="text-text block text-[10px]">Standard</span>
                <span className="text-faint font-mono text-[9px]">
                  {(snapshot.table.params.standardDelay * TICK_MILLIS) / 1000}s · free
                </span>
              </button>
              <button
                type="button"
                aria-pressed={lane === 1}
                onClick={() => setLane(1)}
                className={cn(
                  "rounded border px-2 py-1.5 text-left",
                  lane === 1 ? "border-priority/60 bg-priority/10" : "border-line bg-bg",
                )}
              >
                <span className="text-priority flex items-center gap-1 text-[10px]">
                  <Zap className="size-3" />
                  Priority
                </span>
                <span className="text-faint font-mono text-[9px]">
                  {(snapshot.table.params.priorityDelay * TICK_MILLIS) / 1000}s ·{" "}
                  {snapshot.table.params.priorityFee} chips
                </span>
              </button>
            </div>
          </div>
          <div className="border-line space-y-1 border-t pt-2 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-faint">Average price</span>
              <span>{quote ? (quote.avgPrice / 1_000_000).toFixed(4) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Price impact</span>
              <span>{quote ? `${(quote.impactBps / 100).toFixed(2)}%` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Est. fee</span>
              <span>
                {quote
                  ? `${(quote.fee + BigInt(lane === 1 ? snapshot.table.params.priorityFee : 0)).toString()} chips`
                  : "—"}
              </span>
            </div>
          </div>
          <Button
            variant={side}
            size="sm"
            onClick={() => void send()}
            loading={busy}
            disabled={!view.mine || view.phase !== "live" || !effectiveSize || view.mine.liquidated}
            className="w-full"
          >
            {view.mine ? `Send ${side} order` : "Claim a seat to trade"}{" "}
            <Kbd className="border-current/20 bg-transparent text-inherit">↵</Kbd>
          </Button>
          <p className="text-faint text-center font-mono text-[9px]">
            SIDE + SIZE STAY PRIVATE UNTIL FILL
          </p>
        </div>
      </Panel>
      <Panel
        title="Ghost orders"
        action={
          <span className="text-faint font-mono text-[10px]">{view.myPending.length} PENDING</span>
        }
        className="min-h-[97px]"
      >
        <div className="min-h-12 p-2">
          <AnimatePresence initial={false}>
            {view.myPending.map((order) => (
              <motion.div
                key={order.id}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -36, scale: 1.08 }}
                transition={reducedMotion ? reducedTransition : spring}
                className="border-priority/20 bg-priority/5 mb-1 flex items-center gap-2 rounded border px-2 py-1"
              >
                <div
                  className="grid size-7 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#b58cff ${Math.max(0, 100 - (order.ticksToLand / (order.lane ? 4 : 20)) * 100)}%, #282431 0)`,
                  }}
                >
                  <span className="bg-surface text-priority grid size-5 place-items-center rounded-full font-mono text-[8px]">
                    {(order.ticksToLand / 2).toFixed(0)}
                  </span>
                </div>
                <span className="text-muted flex-1 font-mono text-[9px]">
                  {order.sideSize > 0 ? "BUY" : "SELL"} {Math.abs(order.sideSize)}
                </span>
                <span className="text-priority font-mono text-[9px]">
                  {(order.ticksToLand / 2).toFixed(1)}s
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {!view.myPending.length && (
            <p className="text-faint py-2 text-center text-[10px]">
              Your orders wait here, unseen.
            </p>
          )}
        </div>
      </Panel>
      {view.mine && (
        <Panel className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs">{view.mine.name}</span>
            <span className="text-sealed font-mono text-[9px]">YOUR SEAT</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[9px]">
            <span className="text-faint">
              CHIPS <Num value={view.mine.chips} className="text-text ml-1" />
            </span>
            <span className="text-faint">
              POSITION <span className="text-text">{view.mine.position}</span>
            </span>
            <span className="text-faint">
              EQUITY <Num value={view.mine.equity} className="text-text ml-1" />
            </span>
            <span className="text-faint">
              P&amp;L <Num value={view.mine.pnl} kind="delta" className="ml-1" />
            </span>
          </div>
        </Panel>
      )}
    </div>
  );
}
