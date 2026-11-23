import { PRICE_ONE, WHALE_SEAT } from "@insider/sdk";
import type { ArchivedLeak, ArchivedRound, ArchivedXray } from "./xray-archive";

export const LEAK_KINDS = [
  "Flow",
  "Spotlight",
  "Whale",
  "Full Book",
  "Pin",
  "Drift",
  "Shockwave",
  "Summit",
] as const;
export const RARITIES = ["Common", "Rare", "Epic"] as const;
export type TraceOrder = ArchivedXray["orders"][number];
export type TraceTag = ArchivedXray["tags"][number];

export function traceName(round: ArchivedRound, seat: number): string {
  return seat === WHALE_SEAT
    ? "Whale"
    : (round.seats.find((item) => item.index === seat)?.name ?? `Seat ${seat + 1}`);
}

export function sandwichOrders(tag: TraceTag, orders: TraceOrder[]) {
  const victims = orders.filter(
    (order) => order.seat === tag.victim && order.landTick === tag.victimTick && order.lane === 0,
  );
  for (const victim of victims) {
    const front = orders.find(
      (order) =>
        order.seat === tag.front &&
        order.lane === 1 &&
        order.landTick === tag.frontTick &&
        Math.sign(order.sideSize) === Math.sign(victim.sideSize),
    );
    if (!front) continue;
    const exit = orders
      .filter(
        (order) =>
          order.seat === tag.front &&
          order.landTick > victim.landTick &&
          order.landTick <= victim.landTick + 6 &&
          Math.sign(order.sideSize) === -Math.sign(front.sideSize),
      )
      .sort((a, b) => a.landTick - b.landTick)[0];
    if (exit) return { front, victim, exit };
  }
  return null;
}

export function tagLeak(round: ArchivedRound, tag: TraceTag): ArchivedLeak | undefined {
  const id = round.headers[tag.leakSlot]?.leakId;
  return round.xray.leaks.find((leak) => leak.header.leakId === id);
}

export function payloadOrders(leak: ArchivedLeak, order: TraceOrder): boolean {
  if (leak.header.kind === 0)
    return (
      order.sentTick < leak.header.mintedTick &&
      order.landTick >= (leak.fields[2] ?? 0) &&
      order.landTick <= (leak.fields[3] ?? 0)
    );
  return leak.orders.some(
    (item) =>
      item.sideSize !== 0 &&
      item.seat === order.seat &&
      item.sideSize === order.sideSize &&
      item.landTick === order.landTick &&
      item.lane === order.lane,
  );
}

export function publicPayload(round: ArchivedRound, leak: ArchivedLeak): string[] {
  const f = leak.fields;
  const p = (n: number | undefined) => ((n ?? 0) / PRICE_ONE).toFixed(4);
  const signed = (n: number | undefined) => `${(n ?? 0) > 0 ? "+" : ""}${n ?? 0}`;
  const orders = leak.orders
    .filter((order) => order.sideSize !== 0)
    .map(
      (order) =>
        `${traceName(round, order.seat)} · ${order.sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(order.sideSize)} · ${order.lane === 1 ? "priority" : "standard"} · T+${order.landTick}`,
    );
  switch (leak.header.kind) {
    case 0:
      return [`Net ${signed(f[0])} units · ${f[1]} orders`, `Window T+${f[2]}–${f[3]}`];
    case 1:
    case 2:
    case 3:
      return orders.length ? orders : ["No pending orders captured."];
    case 4:
      return [`Target ${p(f[1])} at T+${f[0]}`];
    case 5:
      return [
        `${(f[2] ?? 0) > 0 ? "Up" : (f[2] ?? 0) < 0 ? "Down" : "Flat"} · ${["<1%", "1–3%", ">3%"][f[3] ?? -1] ?? "—"}`,
        `${signed(f[4])} bps · T+${f[0]}–${f[1]}`,
      ];
    case 6:
      return f[0]
        ? [`Shock at T+${f[1]} · ${(f[2] ?? 0) > 0 ? "positive" : "negative"}`]
        : ["No shock in this window."];
    case 7:
      return [`High ${p(f[0])} at T+${f[1]}`, `Low ${p(f[2])} at T+${f[3]}`];
    default:
      return ["Unknown payload type."];
  }
}

export function shareDetails(round: ArchivedRound) {
  const tag = round.xray.tags[0];
  const leak = tag ? tagLeak(round, tag) : undefined;
  const kind = leak ? (LEAK_KINDS[leak.header.kind] ?? "Leak") : undefined;
  const seat = tag ? traceName(round, tag.front) : undefined;
  const paid = tag && leak && leak.header.ownerSeat === tag.front ? ` for ${leak.header.paid}` : "";
  const line =
    tag && leak
      ? `${seat} read ${kind}${paid} and front-ran ${traceName(round, tag.victim)} for ${tag.profitEstimate > 0 ? "+" : ""}${tag.profitEstimate} chips · INSIDER round ${round.round}`
      : `The tape is public · INSIDER round ${round.round}`;
  return { title: `Round ${round.round}, revealed`, line, kind, seat, pnl: tag?.profitEstimate };
}
