import { describe, expect, it } from "vitest";

import { payloadSignal } from "../src/signal.js";
import { decide, newMemory } from "../src/strategies.js";
import type { BotView, CallView, LeakView, SeatView } from "../src/view.js";

const leak = (patch: Partial<LeakView> = {}): LeakView => ({
  slot: 0,
  leakId: 1,
  kind: 2,
  rarity: 0,
  state: 1,
  ownerSeat: 254,
  price: 8,
  paid: 0,
  licenseAsk: 0,
  readerCount: 0,
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
  seat: {
    index: 0,
    owned: true,
    chips: 1_000,
    position: 0,
    pending: 0,
    unopened: 0,
    liquidated: false,
  },
  desk: { chips: 1_000, position: 0 },
  leaks: [],
  seats: [],
  calls: [],
  payloads: new Map(),
  callDirections: new Map(),
  ...patch,
});

describe("payloadSignal", () => {
  it("follows the whale, the flow and the book", () => {
    const whale = {
      kind: 2,
      fields: [],
      orders: [{ sideSize: -800, landTick: 40 }],
      orderCount: 1,
    };
    expect(payloadSignal(whale, 1)).toMatchObject({ side: -1, why: "whale" });
    expect(
      payloadSignal({ kind: 0, fields: [600, 5, 10, 30, 0, 0], orders: [], orderCount: 0 }, 1),
    ).toMatchObject({ side: 1 });
    const book = {
      kind: 3,
      fields: [],
      orders: [
        { sideSize: 300, landTick: 1 },
        { sideSize: -500, landTick: 1 },
      ],
      orderCount: 2,
    };
    expect(payloadSignal(book, 1)).toMatchObject({ side: -1 });
  });

  it("trades toward the pin and the shock, and ignores an empty payload", () => {
    expect(
      payloadSignal({ kind: 4, fields: [60, 1_100_000], orders: [], orderCount: 0 }, 1)?.side,
    ).toBe(1);
    expect(
      payloadSignal({ kind: 6, fields: [1, 50, -1, 70, 0, 0], orders: [], orderCount: 0 }, 1)?.side,
    ).toBe(-1);
    expect(
      payloadSignal({ kind: 6, fields: [0, 0, 0, 0, 0, 0], orders: [], orderCount: 0 }, 1),
    ).toBeUndefined();
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
    expect(decide("front-runner", view({ leaks: [leak()] }), memory)).toEqual([
      { type: "bid", slot: 0 },
    ]);
    expect(
      decide("front-runner", view({ leaks: [leak({ state: 2, isMine: true })] }), memory),
    ).toEqual([{ type: "open", slot: 0 }]);
    const opened = leak({ state: 4, isMine: true, isReader: true });
    expect(decide("front-runner", view({ leaks: [opened] }), memory)).toEqual([
      { type: "read", slot: 0 },
    ]);
    const payloads = new Map([
      [0, { kind: 2, fields: [], orders: [{ sideSize: 900, landTick: 60 }], orderCount: 1 }],
    ]);
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
    expect(decide("flow", view({ leaks: [leak({ kind: 0 })] }), m)).toEqual([
      { type: "bid", slot: 0 },
    ]);
  });

  it("never trades late, over the position limit, with too many pending or when liquidated", () => {
    const opened = leak({ state: 4, isReader: true });
    const payloads = new Map([
      [0, { kind: 2, fields: [], orders: [{ sideSize: 900, landTick: 60 }], orderCount: 1 }],
    ]);
    for (const patch of [
      { tick: 155 },
      { seat: { ...view().seat, position: 4_900 } },
      { seat: { ...view().seat, pending: 3 } },
      { seat: { ...view().seat, liquidated: true } },
    ]) {
      const actions = decide(
        "front-runner",
        view({ leaks: [opened], payloads, ...patch }),
        newMemory(),
      );
      expect(actions.filter((a) => a.type === "order")).toEqual([]);
    }
  });

  it("the baiter alternates small orders every few ticks and never buys Leaks", () => {
    const m = newMemory();
    const first = decide("baiter", view({ tick: 20, leaks: [leak()] }), m);
    expect(first).toEqual([{ type: "order", sideSize: -60, lane: 0, note: "bait" }]);
    expect(decide("baiter", view({ tick: 24 }), m)).toEqual([]);
    expect(decide("baiter", view({ tick: 28 }), m)).toEqual([
      { type: "order", sideSize: 60, lane: 0, note: "bait" },
    ]);
  });
});

const call = (patch: Partial<CallView> = {}): CallView => ({
  author: 5,
  callId: 9,
  licenseAsk: 20,
  expiry: 2_000,
  readerCount: 0,
  isMine: false,
  isReader: false,
  ...patch,
});
const other = (index: number, position: number): SeatView => ({
  index,
  owned: true,
  position,
  chips: 1_000,
});

describe("the copycat", () => {
  it("copies the seat that moved its position the most, one order every few ticks", () => {
    const memory = newMemory();
    // the first look only records positions
    expect(decide("copycat", view({ seats: [other(1, 0), other(2, 0)] }), memory)).toEqual([]);
    const moved = view({ tick: 40, seats: [other(1, 300), other(2, -100)] });
    expect(decide("copycat", moved, memory)).toEqual([
      { type: "order", sideSize: 150, lane: 0, note: "copy seat 2" },
    ]);
    // too soon after the last copy, and nothing moved
    expect(
      decide("copycat", view({ tick: 43, seats: [other(1, 600), other(2, -100)] }), memory),
    ).toEqual([]);
    expect(
      decide("copycat", view({ tick: 60, seats: [other(1, 600), other(2, -100)] }), memory),
    ).toEqual([]);
  });

  it("sells when the leader sold, ignores itself and free seats, and obeys the trading limits", () => {
    const memory = newMemory();
    decide(
      "copycat",
      view({
        seats: [other(0, 0), other(1, 500), { index: 2, owned: false, position: 0, chips: 0 }],
      }),
      memory,
    );
    const next = view({
      tick: 50,
      seats: [other(0, 900), other(1, 380), { index: 2, owned: false, position: 80, chips: 0 }],
    });
    expect(decide("copycat", next, memory)).toEqual([
      { type: "order", sideSize: -120, lane: 0, note: "copy seat 2" },
    ]);
    const late = view({ tick: 155, seats: [other(1, 0)] });
    const m2 = newMemory();
    decide("copycat", view({ seats: [other(1, 500)] }), m2);
    expect(decide("copycat", late, m2)).toEqual([]);
  });
});

describe("the flipper", () => {
  it("lists every other sealed Leak at about double its price and opens the rest", () => {
    const memory = newMemory();
    const even = leak({ state: 2, isMine: true, leakId: 4, paid: 7 });
    expect(decide("flipper", view({ leaks: [even] }), memory)).toEqual([
      { type: "listLeak", slot: 0, ask: 14 },
    ]);
    // listed once only; afterwards nothing more to do with it
    expect(decide("flipper", view({ leaks: [even] }), memory)).toEqual([]);
    const odd = leak({ state: 2, isMine: true, leakId: 5, paid: 7 });
    expect(decide("flipper", view({ leaks: [odd] }), newMemory())).toEqual([
      { type: "open", slot: 0 },
    ]);
    // a cheap Leak is listed for at least 6
    expect(
      decide(
        "flipper",
        view({ leaks: [leak({ state: 2, isMine: true, leakId: 6, paid: 1 })] }),
        newMemory(),
      ),
    ).toEqual([{ type: "listLeak", slot: 0, ask: 6 }]);
  });

  it("offers licences on a Leak it opened, once", () => {
    const memory = newMemory();
    const opened = leak({ state: 4, isMine: true, isReader: true, leakId: 3 });
    const payloads = new Map([[0, { kind: 2, fields: [], orders: [], orderCount: 0 }]]);
    const first = decide("flipper", view({ leaks: [opened], payloads }), memory);
    expect(first).toContainEqual({ type: "offerLicense", slot: 0, ask: 5 });
    expect(decide("flipper", view({ leaks: [opened], payloads }), memory)).not.toContainEqual({
      type: "offerLicense",
      slot: 0,
      ask: 5,
    });
  });

  it("buys a cheap licence before a listed Leak before an auction, one purchase per decision", () => {
    const licence = leak({ slot: 1, state: 4, ownerSeat: 2, licenseAsk: 8, leakId: 7 });
    const listed = leak({ slot: 2, state: 3, ownerSeat: 3, price: 12, leakId: 8 });
    const auction = leak({ slot: 3, state: 1, price: 10, leakId: 9 });
    const all = view({ leaks: [auction, listed, licence] });
    expect(decide("flipper", all, newMemory())).toEqual([
      { type: "buyLicense", slot: 1, owner: 2 },
    ]);
    expect(decide("flipper", view({ leaks: [auction, listed] }), newMemory())).toEqual([
      { type: "buyListed", slot: 2, seller: 3 },
    ]);
    expect(decide("flipper", view({ leaks: [auction] }), newMemory())).toEqual([
      { type: "bid", slot: 3 },
    ]);
    // too expensive, already a reader, own Leak or the unopened limit
    const dear = leak({ slot: 1, state: 4, ownerSeat: 2, licenseAsk: 40 });
    expect(decide("flipper", view({ leaks: [dear] }), newMemory())).toEqual([]);
    const full = view({ leaks: [auction], seat: { ...view().seat, unopened: 2 } });
    expect(decide("flipper", full, newMemory())).toEqual([]);
  });

  it("licenses somebody else's Desk Call, reads it, and trades its direction once", () => {
    const memory = newMemory();
    expect(decide("flipper", view({ calls: [call()] }), memory)).toEqual([
      { type: "buyCallLicense", author: 5 },
    ]);
    // never twice for the same Call
    expect(decide("flipper", view({ calls: [call()] }), memory)).toEqual([]);
    const licensed = call({ isReader: true });
    expect(decide("flipper", view({ calls: [licensed] }), memory)).toEqual([
      { type: "readCall", author: 5 },
    ]);
    const known = view({ calls: [licensed], callDirections: new Map([[5, -1 as const]]) });
    expect(decide("flipper", known, memory)).toEqual([
      { type: "deskTrade", size: -100, note: "call 9" },
    ]);
    expect(decide("flipper", known, memory)).toEqual([]);
  });

  it("does not license its own Call, an unaffordable one or a full one", () => {
    expect(decide("flipper", view({ calls: [call({ isMine: true })] }), newMemory())).toEqual([]);
    expect(decide("flipper", view({ calls: [call({ licenseAsk: 90 })] }), newMemory())).toEqual([]);
    expect(decide("flipper", view({ calls: [call({ readerCount: 4 })] }), newMemory())).toEqual([]);
    expect(
      decide("flipper", view({ calls: [call()], desk: { chips: 100, position: 0 } }), newMemory()),
    ).toEqual([]);
  });
});
