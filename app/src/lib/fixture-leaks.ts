import { CLOSING_END_TICK, WHALE_SEAT, type LeakVaultAccount, type LocalOrder } from "@insider/sdk";

export type FixtureDrop = {
  tick: number;
  kind: number;
  rarity: number;
  offset: number;
  length: number;
};
export type FixtureOrder = LocalOrder & { seat: number };
export type FixtureShock = { tick: number; bps: number };

export function makeFixtureDrop(tick: number, below: (limit: number) => number): FixtureDrop {
  const roll = below(100);
  const rarity = roll < 65 ? 0 : roll < 95 ? 1 : 2;
  const flow = below(2) === 0;
  const kind =
    rarity === 0
      ? flow
        ? 0
        : below(2) === 0
          ? 4
          : 5
      : rarity === 1
        ? flow
          ? below(2) === 0
            ? 1
            : 2
          : 6
        : flow
          ? 3
          : 7;
  const offset =
    kind === 0 ? 2 + below(11) : kind === 4 ? 10 + below(21) : kind === 5 ? 20 + below(21) : 0;
  return {
    tick,
    kind,
    rarity,
    offset,
    length: kind === 0 ? 10 : kind === 6 ? 40 : kind === 7 ? 60 : 0,
  };
}

export function buildFixturePayload(
  drop: FixtureDrop,
  orders: FixtureOrder[],
  path: number[],
  shocks: FixtureShock[],
  vault: LeakVaultAccount,
): { windowStart: number; windowEnd: number } {
  const tick = Math.min(drop.tick, CLOSING_END_TICK - 1);
  const end = (delta: number) => Math.min(CLOSING_END_TICK - 1, tick + delta);
  const start = end(1);
  const sorted = orders
    .filter((order) => order.sideSize !== 0)
    .sort((a, b) => a.landTick - b.landTick || Number(a.id) - Number(b.id));
  let captured: FixtureOrder[] = [];
  let windowStart = start;
  let windowEnd = end(20);
  vault.kind = drop.kind;
  vault.mintedTick = tick;
  vault.orderCount = 0;
  vault.fields = [0, 0, 0, 0, 0, 0];
  vault.orders = vault.orders.map(() => ({ seat: 0, lane: 0, sideSize: 0, landTick: 0, seq: 0 }));
  if (drop.kind === 0) {
    windowStart = end(drop.offset);
    windowEnd = end(drop.offset + drop.length - 1);
    const matching = sorted.filter((o) => o.landTick >= windowStart && o.landTick <= windowEnd);
    vault.fields = [
      matching.reduce((total, o) => total + o.sideSize, 0),
      matching.length,
      windowStart,
      windowEnd,
      0,
      0,
    ];
  } else if (drop.kind === 1) {
    const candidates = sorted
      .filter((o) => o.seat !== WHALE_SEAT)
      .sort((a, b) => Math.abs(b.sideSize) - Math.abs(a.sideSize) || Number(a.id) - Number(b.id));
    captured = candidates.slice(0, 1);
  } else if (drop.kind === 2) {
    captured = sorted
      .filter((o) => o.seat === WHALE_SEAT && o.landTick > tick && o.landTick <= end(60))
      .slice(0, 1);
  } else if (drop.kind === 3) {
    captured = sorted.slice(0, vault.orders.length);
  } else if (drop.kind === 4) {
    windowStart = windowEnd = end(drop.offset);
    vault.fields = [windowEnd, path[windowEnd]!, 0, 0, 0, 0];
  } else if (drop.kind === 5) {
    windowEnd = end(drop.offset);
    const from = path[tick]!;
    const bps = from === 0 ? 0 : Math.trunc(((path[windowEnd]! - from) * 10_000) / from);
    vault.fields = [
      tick,
      windowEnd,
      Math.sign(bps),
      Math.abs(bps) < 100 ? 0 : Math.abs(bps) <= 300 ? 1 : 2,
      bps,
      0,
    ];
  } else if (drop.kind === 6) {
    windowEnd = end(40);
    const shock = shocks
      .filter((s) => s.tick > tick && s.tick <= windowEnd)
      .sort((a, b) => a.tick - b.tick)[0];
    vault.fields = shock
      ? [1, shock.tick, Math.sign(shock.bps), windowEnd, 0, 0]
      : [0, 0, 0, windowEnd, 0, 0];
  } else if (drop.kind === 7) {
    windowEnd = end(60);
    let high = start,
      low = start;
    for (let t = start; t <= windowEnd; t++) {
      if (path[t]! > path[high]!) high = t;
      if (path[t]! < path[low]!) low = t;
    }
    vault.fields = [path[high]!, high, path[low]!, low, start, windowEnd];
  }
  if (drop.kind >= 1 && drop.kind <= 3) {
    vault.orderCount = captured.length;
    captured.forEach((o, i) => {
      vault.orders[i] = {
        seat: o.seat,
        lane: o.lane,
        sideSize: o.sideSize,
        landTick: o.landTick,
        seq: Number(o.id),
      };
    });
    windowEnd = captured.length
      ? Math.min(CLOSING_END_TICK - 1, Math.max(...captured.map((o) => o.landTick)))
      : end(20);
  }
  return { windowStart, windowEnd };
}
