import { Keypair, PublicKey } from "@solana/web3.js";
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

describe("buildView for the second wave", () => {
  it("lists the other seats, the open Calls and the Desk balance", () => {
    const other = Keypair.generate().publicKey;
    const view = buildView(
      decoded({
        seat: {
          index: 0,
          owner: me,
          chips: 950,
          position: 120,
          pendingCount: 1,
          deskChips: 800,
          deskPosition: -40,
        },
        seats: [
          { index: 0, owner: me, chips: 950, position: 120 },
          { index: 1, owner: other, chips: 1_000, position: -300 },
          { index: 2, owner: PublicKey.default, chips: 0, position: 0 },
        ],
        calls: [
          {
            callId: 4,
            authorSeat: 1,
            state: 1,
            expiryTs: 5_000,
            licenseAsk: 25,
            readers: [me, PublicKey.default],
          },
          { callId: 3, authorSeat: 2, state: 2, expiryTs: 100, licenseAsk: 0, readers: [] },
        ],
      }),
      me,
      new Map(),
      new Map([[1, 1 as const]]),
    );
    expect(view.desk).toEqual({ chips: 800, position: -40 });
    expect(view.seats.map((s) => [s.index, s.owned, s.position])).toEqual([
      [0, true, 120],
      [1, true, -300],
      [2, false, 0],
    ]);
    // a settled Call is not offered
    expect(view.calls).toEqual([
      {
        author: 1,
        callId: 4,
        licenseAsk: 25,
        expiry: 5_000,
        readerCount: 1,
        isMine: false,
        isReader: true,
      },
    ]);
    expect(view.callDirections.get(1)).toBe(1);
  });

  it("reads what a leak cost and what its licence asks", () => {
    const view = buildView(
      decoded({
        board: {
          roundId: 2,
          headers: [header({ state: 4, ownerSeat: 3, paid: 9, licenseAsk: 5 })],
        },
      }),
      me,
      new Map(),
    );
    expect(view.leaks[0]).toMatchObject({ paid: 9, licenseAsk: 5, readerCount: 0 });
  });
});
