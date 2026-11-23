import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { DUTCH_TICKS, buildView, dutchPrice, type Decoded } from "../src/observe.js";

const me = Keypair.generate().publicKey;
const header = (patch = {}) => ({
  leakId: 3,
  kind: 2,
  rarity: 0,
  state: 1,
  ownerSeat: 254,
  auctionStart: 10,
  startPrice: 20,
  floorPrice: 2,
  ask: 0,
  readerCount: 0,
  readers: [],
  ...patch,
});
const decoded = (patch: Partial<Decoded> = {}): Decoded => ({
  table: { roundId: 2, tick: 14, phase: { live: {} } },
  market: { price: 1_020_000 },
  board: {
    roundId: 2,
    headers: [header(), header({ state: 4, ownerSeat: 0, readerCount: 1, readers: [me] })],
  },
  seat: { index: 0, owner: me, chips: 950, position: 120, pendingCount: 1 },
  liquidated: false,
  ...patch,
});

describe("dutchPrice", () => {
  it("falls from start to floor over the auction and stays at the floor", () => {
    expect(dutchPrice(20, 2, 10, 10)).toBe(20);
    expect(dutchPrice(20, 2, 10, 10 + DUTCH_TICKS - 1)).toBe(2);
    expect(dutchPrice(20, 2, 10, 50)).toBe(2);
    expect(dutchPrice(20, 2, 10, 5)).toBe(20);
  });
});

describe("buildView", () => {
  it("reads the seat, the price and which leaks are mine", () => {
    const view = buildView(decoded(), me, new Map());
    expect(view).toMatchObject({ roundId: 2, tick: 14, phase: "live", price: 1.02 });
    expect(view.seat).toMatchObject({ owned: true, chips: 950, position: 120, pending: 1 });
    expect(view.leaks[0]).toMatchObject({
      state: 1,
      isMine: false,
      price: dutchPrice(20, 2, 10, 14),
    });
    expect(view.leaks[1]).toMatchObject({ state: 4, isMine: true, isReader: true });
  });

  it("ignores leaks left over from an older round", () => {
    const view = buildView(decoded({ board: { roundId: 1, headers: [header()] } }), me, new Map());
    expect(view.leaks).toEqual([]);
  });

  it("counts owned and listed leaks as unopened, and sees a seat someone else holds", () => {
    const owned = decoded({
      board: {
        roundId: 2,
        headers: [header({ state: 2, ownerSeat: 0 }), header({ state: 3, ownerSeat: 0 })],
      },
    });
    expect(buildView(owned, me, new Map()).seat.unopened).toBe(2);
    const taken = decoded({
      seat: {
        index: 0,
        owner: Keypair.generate().publicKey,
        chips: 1000,
        position: 0,
        pendingCount: 0,
      },
    });
    expect(buildView(taken, me, new Map()).seat.owned).toBe(false);
  });
});
