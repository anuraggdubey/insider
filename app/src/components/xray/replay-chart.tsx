"use client";

import { PRICE_ONE, WHALE_SEAT } from "@insider/sdk/constants";
import type { ArchivedLeak, ArchivedRound } from "@/lib/xray-archive";
import { payloadOrders, sandwichOrders, traceName } from "@/lib/xray-data";

const W = 1000;
const H = 310;
const LEFT = 18;
const RIGHT = 960;
const TOP = 20;
const BOTTOM = 270;
const x = (tick: number) => LEFT + (Math.min(180, Math.max(0, tick)) / 180) * (RIGHT - LEFT);

export function ReplayChart({
  round,
  tick,
  selected,
}: {
  round: ArchivedRound;
  tick: number;
  selected?: ArchivedLeak;
}) {
  const history = round.history.slice(0, tick + 1);
  const filled = round.xray.orders.filter((order) => order.landTick <= tick);
  const values = [
    ...history.filter((n) => n > 0),
    ...filled.map((order) => order.fillPrice).filter((n) => n > 0),
  ];
  const min = values.length ? Math.min(...values) : PRICE_ONE - 1;
  const max = values.length ? Math.max(...values) : PRICE_ONE + 1;
  const spread = Math.max(max - min, 1);
  const y = (price: number) =>
    BOTTOM - ((price - min + spread * 0.1) / (spread * 1.2)) * (BOTTOM - TOP);
  const path = history
    .map((price, i) =>
      price ? `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(price).toFixed(1)}` : "",
    )
    .filter(Boolean)
    .join(" ");
  const currentPrice = (at: number) =>
    history[Math.min(at, history.length - 1)] || history.filter(Boolean).at(-1) || PRICE_ONE;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Price replay through tick ${tick}`}
    >
      <defs>
        <marker
          id="arrow-standard"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 Z" fill="#c2d2fb" />
        </marker>
        <marker
          id="arrow-priority"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 Z" fill="#ffa53a" />
        </marker>
        <marker
          id="arrow-whale"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 Z" fill="#5fd6ff" />
        </marker>
      </defs>
      {[0, 1, 2, 3, 4].map((line) => (
        <line
          key={line}
          x1={LEFT}
          x2={RIGHT}
          y1={TOP + line * 60}
          y2={TOP + line * 60}
          stroke="#243a85"
        />
      ))}
      {[0, 45, 90, 135, 180].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={TOP} y2={BOTTOM} stroke="#1a2c6b" />
          <text
            x={x(t)}
            y="299"
            fill="#a8baee"
            fontSize="11"
            textAnchor={t === 180 ? "end" : "start"}
          >
            T+{t}
          </text>
        </g>
      ))}
      {path && <path d={path} fill="none" stroke="#ffd21f" strokeWidth="2" />}
      {round.xray.orders.map((order, i) => {
        if (order.sentTick > tick || (order.seat === WHALE_SEAT && order.landTick > tick))
          return null;
        const landed = order.landTick <= tick;
        const color =
          order.seat === WHALE_SEAT ? "#5fd6ff" : order.lane === 1 ? "#ffa53a" : "#c2d2fb";
        const highlighted = selected && landed && payloadOrders(selected, order);
        const startY = landed ? y(order.fillPrice) : y(currentPrice(order.sentTick));
        const endY = landed ? y(order.fillPrice) : y(currentPrice(tick));
        const title = landed
          ? `${traceName(round, order.seat)} · ${order.sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(order.sideSize)} · ${order.lane === 1 ? "priority" : "standard"} · T+${order.sentTick} → T+${order.landTick} · ${(order.fillPrice / PRICE_ONE).toFixed(4)}`
          : `${traceName(round, order.seat)} · ${order.lane === 1 ? "priority" : "standard"} order pending`;
        return (
          <line
            key={`${i}-${order.sentTick}`}
            x1={x(order.sentTick)}
            x2={x(Math.min(order.landTick, tick))}
            y1={startY}
            y2={endY}
            stroke={highlighted ? "#ffd21f" : color}
            opacity={selected && landed && !highlighted ? 0.26 : landed ? 0.8 : 0.5}
            strokeWidth={highlighted ? 2.5 : 1.1}
            strokeDasharray={landed ? undefined : "4 4"}
            markerEnd={
              landed
                ? `url(#arrow-${order.seat === WHALE_SEAT ? "whale" : order.lane === 1 ? "priority" : "standard"})`
                : undefined
            }
            tabIndex={0}
          >
            <title>{title}</title>
          </line>
        );
      })}
      {round.xray.tags.map((tag, i) => {
        const triple = sandwichOrders(tag, round.xray.orders);
        if (!triple || triple.exit.landTick > tick) return null;
        const a = x(triple.front.landTick),
          b = x(triple.victim.landTick),
          c = x(triple.exit.landTick);
        const base = Math.max(
          45,
          Math.min(
            y(triple.front.fillPrice),
            y(triple.victim.fillPrice),
            y(triple.exit.fillPrice),
          ) - 10,
        );
        const high = Math.max(12, base - 34 - (i % 3) * 12);
        return (
          <g key={i} data-testid="sandwich-arc">
            <path
              d={`M${a} ${base} Q${(a + b) / 2} ${high} ${b} ${base} Q${(b + c) / 2} ${high} ${c} ${base}`}
              fill="none"
              stroke="#ffd21f"
              strokeWidth="1.6"
            />
            <text x={b} y={high - 4} fill="#ffd21f" textAnchor="middle" fontSize="11">
              {tag.profitEstimate > 0 ? "+" : ""}
              {tag.profitEstimate} chips
            </text>
            <title>
              {traceName(round, tag.front)} / {traceName(round, tag.victim)}
            </title>
          </g>
        );
      })}
      <line
        x1={x(tick)}
        x2={x(tick)}
        y1={TOP}
        y2={BOTTOM}
        stroke="#4fd2ff"
        opacity=".35"
        strokeDasharray="3 5"
      />
      <text x="996" y={TOP + 10} fill="#a8baee" fontSize="11" textAnchor="end">
        {(max / PRICE_ONE).toFixed(3)}
      </text>
      <text x="996" y={BOTTOM} fill="#a8baee" fontSize="11" textAnchor="end">
        {(min / PRICE_ONE).toFixed(3)}
      </text>
    </svg>
  );
}
