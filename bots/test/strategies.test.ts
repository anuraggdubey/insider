import { describe, expect, it } from "vitest";

import { payloadSignal } from "../src/signal.js";
import { decide, newMemory } from "../src/strategies.js";
import type { BotView, LeakView } from "../src/view.js";

const leak = (patch: Partial<LeakView> = {}): LeakView => ({
  slot: 0,
  leakId: 1,
  kind: 2,
  rarity: 0,
  state: 1,
  ownerSeat: 254,
  price: 8,
  auctionOver: false,
  isMine: false,
  isReader: false,
  ...patch,
});

const view = (patch: Partial<BotView> = {}): BotView => ({
  roundId: 1,
  tick: 30,
  phase: "live",
  price: 1,
  seat: { index: 0, owned: true, chips: 1_000, position: 0, pending: 0, unopened: 0, liquidated: false },
  leaks: [],
  payloads: new Map(),
  ...patch,
});

describe("payloadSignal", () => {
  it("follows the whale, the flow and the book", () => {
    const whale = { kind: 2, fields: [], orders: [{ sideSize: -800, landTick: 40 }], orderCount: 1 };
    expect(payloadSignal(whale, 1)).toMatchObject({ side: -1, why: "whale" });
    expect(payloadSignal({ kind: 0, fields: [600, 5, 10, 30, 0, 0], orders: [], orderCount: 0 }, 1)).toMatchObject({ side: 1 });
    const book = { kind: 3, fields: [], orders: [{ sideSize: 300, landTick: 1 }, { sideSize: -500, landTick: 1 }], orderCount: 2 };
    expect(payloadSignal(book, 1)).toMatchObject({ side: -1 });
  });

  it("trades toward the pin and the shock, and ignores an empty payload", () => {
    expect(payloadSignal({ kind: 4, fields: [60, 1_100_000], orders: [], orderCount: 0 }, 1)?.side).toBe(1);
    expect(payloadSignal({ kind: 6, fields: [1, 50, -1, 70, 0, 0], orders: [], orderCount: 0 }, 1)?.side).toBe(-1);
    expect(payloadSignal({ kind: 6, fields: [0, 0, 0, 0, 0, 0], orders: [], orderCount: 0 }, 1)).toBeUndefined();
    expect(payloadSignal({ kind: 2, fields: [], orders: [], orderCount: 0 }, 1)).toBeUndefined();
  });
});

describe("decide", () => {
  it("claims a seat it does not hold, and does nothing between rounds", () => {
    const v = view({ seat: { ...view().seat, owned: false } });
    expect(decide("flow", v, newMemory())).toEqual([{ type: "claim" }]);
    expect(decide("flow", view({ phase: "idle" }), newMemory())).toEqual([]);
  });

  it("the front-runner bids on a Whale leak, opens what it owns, then reads and fires on priority", () => {
    const memory = newMemory();
    expect(decide("front-runner", view({ leaks: [leak()] }), memory)).toEqual([{ type: "bid", slot: 0 }]);
    expect(decide("front-runner", view({ leaks: [leak({ state: 2, isMine: true })] }), memory)).toEqual([{ type: "open", slot: 0 }]);
    const opened = leak({ state: 4, isMine: true, isReader: true });
    expect(decide("front-runner", view({ leaks: [opened] }), memory)).toEqual([{ type: "read", slot: 0 }]);
    const payloads = new Map([[0, { kind: 2, fields: [], orders: [{ sideSize: 900, landTick: 60 }], orderCount: 1 }]]);
    const [order] = decide("front-runner", view({ leaks: [opened], payloads }), memory);
    expect(order).toMatchObject({ type: "order", lane: 1 });
    expect((order as { sideSize: number }).sideSize).toBeGreaterThan(0);
    // a Leak is only traded once
    expect(decide("front-runner", view({ leaks: [opened], payloads }), memory)).toEqual([]);
  });

  it("respects the unopened limit, the price cap and the kinds a persona wants", () => {
    const m = newMemory();
    const full = view({ seat: { ...view().seat, unopened: 2 }, leaks: [leak()] });
    expect(decide("front-runner", full, m)).toEqual([]);
    expect(decide("front-runner", view({ leaks: [leak({ price: 40 })] }), m)).toEqual([]);
    expect(decide("flow", view({ leaks: [leak({ kind: 2 })] }), m)).toEqual([]);
    expect(decide("flow", view({ leaks: [leak({ kind: 0 })] }), m)).toEqual([{ type: "bid", slot: 0 }]);
  });

  it("never trades late, over the position limit, with too many pending or when liquidated", () => {
    const opened = leak({ state: 4, isReader: true });
    const payloads = new Map([[0, { kind: 2, fields: [], orders: [{ sideSize: 900, landTick: 60 }], orderCount: 1 }]]);
    for (const patch of [
      { tick: 155 },
      { seat: { ...view().seat, position: 4_900 } },
      { seat: { ...view().seat, pending: 3 } },
      { seat: { ...view().seat, liquidated: true } },
    ]) {
      const actions = decide("front-runner", view({ leaks: [opened], payloads, ...patch }), newMemory());
      expect(actions.filter((a) => a.type === "order")).toEqual([]);
    }
  });

  it("the baiter alternates small orders every few ticks and never buys Leaks", () => {
    const m = newMemory();
    const first = decide("baiter", view({ tick: 20, leaks: [leak()] }), m);
    expect(first).toEqual([{ type: "order", sideSize: -60, lane: 0, note: "bait" }]);
    expect(decide("baiter", view({ tick: 24 }), m)).toEqual([]);
    expect(decide("baiter", view({ tick: 28 }), m)).toEqual([{ type: "order", sideSize: 60, lane: 0, note: "bait" }]);
  });
});
