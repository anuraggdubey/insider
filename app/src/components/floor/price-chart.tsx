"use client";

import {
  LineSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { motion, useReducedMotion } from "framer-motion";
import { Crosshair, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LeakVaultAccount, TableView } from "@insider/sdk";
import { Panel } from "@/components/ui/panel";
import { Readout } from "@/components/ui/readout";
import { landingFlash } from "@/lib/motion";

const EPOCH = 1_700_000_000;
const time = (tick: number) => (EPOCH + tick) as UTCTimestamp;
type Overlay = {
  id: string;
  left: number;
  width?: number;
  top?: number;
  height?: number;
  text: string;
  kind: string;
};

export function PriceChart({
  view,
  vaults,
}: {
  view: TableView;
  vaults: Record<number, LeakVaultAccount>;
}) {
  const node = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Line"> | null>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const host = node.current;
    if (!host) return;
    const instance = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0c0e11" },
        textColor: "#8a93a0",
        fontSize: 10,
        fontFamily: "var(--font-jetbrains), monospace",
        attributionLogo: false,
      },
      grid: { vertLines: { color: "#14191f" }, horzLines: { color: "#171c23" } },
      rightPriceScale: { borderColor: "#1d222a", scaleMargins: { top: 0.16, bottom: 0.18 } },
      timeScale: {
        borderColor: "#1d222a",
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (value: Time) => `T+${Number(value) - EPOCH}`,
      },
      crosshair: {
        vertLine: { color: "#566070", labelBackgroundColor: "#2a313b" },
        horzLine: { color: "#566070", labelBackgroundColor: "#2a313b" },
      },
    });
    const area = instance.addSeries(LineSeries, {
      color: "#5ab4ff",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    });
    chart.current = instance;
    series.current = area;
    const observer = new ResizeObserver(() =>
      instance.applyOptions({ width: host.clientWidth, height: host.clientHeight }),
    );
    observer.observe(host);
    return () => {
      observer.disconnect();
      instance.remove();
      chart.current = null;
      series.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chart.current;
    const area = series.current;
    if (!instance || !area) return;
    const visible = view.priceSeries.map((point) => ({
      time: time(point.tick),
      value: point.value / 1_000_000,
    }));
    const futureTicks = [
      ...view.myPending.map((order) => order.landTick),
      ...view.leaks
        .filter((leak) => vaults[leak.leakId])
        .flatMap((leak) => [leak.windowStart, leak.windowEnd]),
    ];
    const end = Math.min(199, Math.max(view.tick + 12, ...futureTicks, view.tick));
    const last = view.priceSeries.at(-1)?.tick ?? -1;
    const points = [
      ...visible,
      ...Array.from({ length: Math.max(0, end - last) }, (_, i) => ({ time: time(last + i + 1) })),
    ];
    area.setData(points);
    const revealedPrices = view.leaks
      .flatMap((leak) => {
        const vault = leak.isReader ? vaults[leak.leakId] : undefined;
        if (!vault) return [];
        if (leak.kind === 4) return [vault.fields[1]! / 1_000_000];
        if (leak.kind === 7) return [vault.fields[0]! / 1_000_000, vault.fields[2]! / 1_000_000];
        return [];
      })
      .filter((price) => price > 0);
    area.applyOptions({
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        if (!info?.priceRange || !revealedPrices.length) return info;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, ...revealedPrices),
            maxValue: Math.max(info.priceRange.maxValue, ...revealedPrices),
          },
        };
      },
    });
    const markers: SeriesMarker<UTCTimestamp>[] = view.feed
      .filter((event) => event.type === "fill" && event.tick <= last)
      .map((event) => {
        if (event.type !== "fill") throw new Error("Expected a fill");
        const mine = event.seat === view.mine?.index;
        return {
          time: time(event.tick),
          position: event.side > 0 ? ("belowBar" as const) : ("aboveBar" as const),
          shape: event.side > 0 ? ("arrowUp" as const) : ("arrowDown" as const),
          color:
            event.seat === 255
              ? "#5ccbf0"
              : mine
                ? "#ffb547"
                : event.side > 0
                  ? "#3ddc97"
                  : "#ff5c6c",
          text: mine ? "YOU" : event.seat === 255 ? "WHALE" : undefined,
        };
      })
      .sort((a, b) => a.time - b.time);
    const markerPlugin = createSeriesMarkers(area, markers);
    instance.timeScale().setVisibleLogicalRange({
      from: Math.max(-2, points.length - 100),
      to: points.length + 7,
    });
    const x = (tick: number) => instance.timeScale().timeToCoordinate(time(tick));
    const y = (price: number) => area.priceToCoordinate(price / 1_000_000);
    const next: Overlay[] = [];
    for (const order of view.myPending) {
      const left = x(order.landTick);
      if (left !== null)
        next.push({
          id: order.id,
          left,
          kind: "landing",
          text: `${(order.ticksToLand / 2).toFixed(1)}s`,
        });
    }
    for (const leak of view.leaks) {
      const vault = vaults[leak.leakId];
      if (!vault || !leak.isReader) continue;
      const start = x(leak.windowStart);
      const endX = x(leak.windowEnd);
      if (start === null || endX === null) continue;
      if (leak.kind === 0)
        next.push({
          id: `leak-${leak.leakId}`,
          left: start,
          width: Math.max(2, endX - start),
          kind: "window",
          text: "FLOW WINDOW",
        });
      else if (leak.kind === 4) {
        const top = y(vault.fields[1] ?? 0);
        next.push({
          id: `leak-${leak.leakId}`,
          left: endX,
          top: top ?? 100,
          kind: "pin",
          text: "PIN",
        });
      } else if (leak.kind === 7) {
        const highX = x(vault.fields[1]!);
        const lowX = x(vault.fields[3]!);
        const highY = y(vault.fields[0]!);
        const lowY = y(vault.fields[2]!);
        if (highX !== null && lowX !== null && highY !== null && lowY !== null)
          next.push({
            id: `leak-${leak.leakId}`,
            left: Math.min(highX, lowX),
            width: Math.max(16, Math.abs(highX - lowX)),
            top: Math.min(highY, lowY),
            height: Math.max(16, Math.abs(highY - lowY)),
            kind: "bracket",
            text: "SUMMIT",
          });
      } else {
        const shockX = leak.kind === 6 && vault.fields[0] ? x(vault.fields[1]!) : null;
        const text =
          leak.kind === 5
            ? vault.fields[2]! > 0
              ? "↗ DRIFT"
              : vault.fields[2]! < 0
                ? "↘ DRIFT"
                : "→ DRIFT"
            : leak.kind === 6
              ? vault.fields[0]
                ? "ϟ SHOCKWAVE"
                : "NO SHOCK"
              : leak.kindName.toUpperCase();
        next.push({ id: `leak-${leak.leakId}`, left: shockX ?? endX, top: 42, kind: "note", text });
      }
    }
    setOverlays(next);
    return () => {
      if (chart.current === instance) markerPlugin.detach();
    };
  }, [view, vaults]);

  const change = view.priceSeries.length > 1 ? view.price - view.priceSeries[0]!.value : 0;
  const landing = view.feed.find(
    (event) => event.type === "fill" && event.seat === view.mine?.index && event.tick === view.tick,
  );
  return (
    <Panel className="screen h-[470px] min-[1440px]:flex min-[1440px]:h-full min-[1440px]:min-h-0 min-[1440px]:flex-col">
      <div className="border-line flex h-[73px] shrink-0 items-center justify-between border-b px-5">
        <div>
          <div className="micro-label flex items-center gap-2">
            <Crosshair className="size-3" /> Floor / virtual market
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <Readout
              value={view.price / 1_000_000}
              format={{ minimumFractionDigits: 4, maximumFractionDigits: 4 }}
              className="text-2xl font-bold tracking-tight"
            />
            <span className={change >= 0 ? "text-buy text-[10px]" : "text-sell text-[10px]"}>
              {change >= 0 ? "+" : ""}
              {(change / 1_000_000).toFixed(4)}
            </span>
          </div>
        </div>
        <div className="text-faint flex items-center gap-2 font-mono text-[9px] tracking-wider">
          <TrendingUp className="text-sealed size-3" /> LIVE PRICE
        </div>
      </div>
      <div
        className="relative h-[396px] overflow-hidden min-[1440px]:min-h-0 min-[1440px]:flex-1"
        data-testid="price-chart"
      >
        <div ref={node} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlays.map((overlay) =>
            overlay.kind === "landing" ? (
              <div
                key={overlay.id}
                className="border-you/70 absolute top-3 bottom-8 border-l border-dashed"
                style={{ left: overlay.left }}
              >
                <span className="bg-you/15 text-you absolute top-0 left-1 rounded px-1.5 py-1 font-mono text-[9px]">
                  {overlay.text}
                </span>
              </div>
            ) : overlay.kind === "window" ? (
              <div
                key={overlay.id}
                className="border-opened/30 bg-opened/8 absolute top-5 bottom-8 border-x"
                style={{ left: overlay.left, width: overlay.width }}
              >
                <span className="text-opened absolute top-1 left-1 font-mono text-[8px]">
                  {overlay.text}
                </span>
              </div>
            ) : overlay.kind === "bracket" ? (
              <div
                key={overlay.id}
                className="border-opened/70 absolute border-t border-r border-b"
                style={{
                  left: overlay.left,
                  top: overlay.top,
                  width: overlay.width,
                  height: overlay.height,
                }}
              >
                <span className="text-opened absolute -top-4 right-0 font-mono text-[9px]">
                  {overlay.text}
                </span>
              </div>
            ) : (
              <div
                key={overlay.id}
                data-testid={`chart-overlay-${overlay.kind}`}
                className="text-opened absolute rounded border border-[#ffb54755] bg-[#261a0d] px-1.5 py-1 font-mono text-[9px]"
                style={{
                  left: overlay.left,
                  top: `min(${Math.max(10, overlay.top ?? 40)}px, calc(100% - 35px))`,
                }}
              >
                {overlay.kind === "pin" && "● "}
                {overlay.text}
              </div>
            ),
          )}
          {landing && !reducedMotion && (
            <motion.div
              key={`flash-${landing.tick}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              transition={landingFlash}
              className="absolute inset-0 bg-[#ffb547]"
            />
          )}
        </div>
      </div>
    </Panel>
  );
}
