import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  decodeAccount,
  deriveTable,
  seatName,
  SEAT_NAMES,
  type LocalOrder,
  type TableSnapshot,
} from "../src/index.js";
import vectors from "./fixtures/vectors.json";

const bn = (n: number) => new BN(n);
function fixture() {
  const owner = Keypair.generate().publicKey;
  const market = decodeAccount("market", Buffer.from(vectors.raw.market, "base64"));
  market.price = 1_200_000;
  market.history.fill(0);
  market.history[0] = 1_000_000;
  market.history[3] = 1_100_000;
  market.history[10] = 1_200_000;
  market.history[11] = 1_300_000;
  market.liquidatedMask = 1 << 1;
  const board = decodeAccount("board", Buffer.from(vectors.raw.board, "base64"));
  for (const header of board.headers) Object.assign(header, { state: 0, ownerSeat: 254 });
  Object.assign(board.headers[0]!, {
    leakId: 1,
    kind: 0,
    state: 1,
    auctionStart: 8,
    windowEnd: 20,
    startPrice: 60,
    floorPrice: 5,
  });
  Object.assign(board.headers[1]!, { leakId: 2, kind: 1, state: 2, ownerSeat: 0, windowEnd: 20 });
  Object.assign(board.headers[2]!, {
    leakId: 3,
    kind: 4,
    state: 3,
    ownerSeat: 1,
    ask: 50,
    windowEnd: 20,
  });
  Object.assign(board.headers[3]!, {
    leakId: 4,
    kind: 7,
    state: 4,
    ownerSeat: 1,
    licenseAsk: 30,
    windowEnd: 20,
    readerCount: 1,
    readers: [
      Keypair.generate().publicKey,
      PublicKey.default,
      PublicKey.default,
      PublicKey.default,
    ],
  });
  const table = {
    phase: { live: {} },
    tick: 10,
    roundId: 7,
    roundStartSlot: bn(1000),
  } as TableSnapshot["table"];
  const seats = [
    {
      index: 0,
      owner,
      nameIdx: 0,
      kind: { human: {} },
      chips: bn(900),
      position: 100,
      lastSeenTick: 2,
    },
    {
      index: 1,
      owner: Keypair.generate().publicKey,
      nameIdx: 1,
      kind: { bot: {} },
      chips: bn(1000),
      position: 0,
      lastSeenTick: 1,
    },
    {
      index: 2,
      owner: PublicKey.default,
      nameIdx: 2,
      kind: { ai: {} },
      chips: bn(1000),
      position: 0,
      lastSeenTick: 0,
    },
  ] as TableSnapshot["seats"];
  const tape = {
    sendsHead: 6,
    sends: [
      { seat: 0, lane: 1, sentTick: 4 },
      { seat: 1, lane: 0, sentTick: 5 },
      { seat: 2, lane: 0, sentTick: 2 },
      { seat: 1, lane: 1, sentTick: 3 },
    ],
    fillsHead: 5,
    fills: [
      { seat: 255, side: 1, size: 100, price: 1_200_000, landedTick: 9 },
      { seat: 1, side: -1, size: 50, price: 1_100_000, landedTick: 6 },
      { seat: 1, side: 1, size: 50, price: 1_100_000, landedTick: 7 },
      { seat: 0, side: 1, size: 100, price: 1_150_000, landedTick: 8 },
    ],
  } as TableSnapshot["tape"];
  const pending: LocalOrder[] = [
    { id: "one", sideSize: 50, lane: 0, sentTick: 0, landTick: 12, round: 7 },
    { id: "landed", sideSize: -50, lane: 1, sentTick: 6, landTick: 10, round: 7 },
    { id: "other-round", sideSize: 100, lane: 0, sentTick: 0, landTick: 20, round: 6 },
  ];
  return { input: { table, market, board, seats, tape }, owner, pending };
}

describe("deriveTable", () => {
  it("derives phases, exact equity, named seats, liquidations, history and pending orders", () => {
    const { input, owner, pending } = fixture();
    const view = deriveTable(input, { me: owner, pending, nowSlot: 1025 });
    expect(view).toMatchObject({
      phase: "live",
      tick: 10,
      round: 7,
      ticksLeftInPhase: 150,
      secondsLeft: 74.75,
      price: 1_200_000,
    });
    expect(view.priceSeries).toEqual([
      { tick: 0, value: 1_000_000 },
      { tick: 3, value: 1_100_000 },
      { tick: 10, value: 1_200_000 },
    ]);
    expect(view.seats[0]).toMatchObject({
      name: SEAT_NAMES[0],
      kind: "human",
      isMe: true,
      chips: 900,
      equity: 1020,
      pnl: 20,
      lastSend: { lane: 1, tick: 4 },
    });
    expect(view.seats[1]!.liquidated).toBe(true);
    expect(view.seats[2]!.isFree).toBe(true);
    expect(view.myPending.map((order) => [order.id, order.ticksToLand])).toEqual([["one", 2]]);
  });

  it("merges wrapped sends and fills newest first, with no hidden order data on sends", () => {
    const { input } = fixture();
    const feed = deriveTable(input).feed;
    expect(feed.map((event) => event.tick)).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
    expect(feed.filter((event) => event.type === "send").map((event) => event.tick)).toEqual([
      5, 4, 3, 2,
    ]);
    for (const event of feed.filter((event) => event.type === "send"))
      expect(event).not.toHaveProperty("size");
  });

  it("applies auction, ownership, hoard, reader, balance, phase and expiry rules", () => {
    const { input, owner } = fixture();
    let view = deriveTable(input, { me: owner });
    expect(view.leaks[0]).toMatchObject({
      kindName: "Flow",
      family: "Flow",
      currentPrice: 51,
      ticksLeft: 10,
      canBid: true,
    });
    expect(view.leaks[1]).toMatchObject({
      kindName: "Spotlight",
      isMine: true,
      canOpen: true,
      canList: true,
    });
    expect(view.leaks[2]).toMatchObject({ kindName: "Pin", family: "Fundamentals", canBuy: true });
    expect(view.leaks[3]).toMatchObject({ kindName: "Summit", canLicense: true });
    input.board.headers[4]!.state = 2;
    input.board.headers[4]!.ownerSeat = 0;
    view = deriveTable(input, { me: owner });
    expect(view.leaks[0]!.canBid).toBe(false);
    expect(view.leaks[2]!.canBuy).toBe(false);
    input.board.headers[3]!.readers[0] = owner;
    expect(deriveTable(input, { me: owner }).leaks[3]!.canLicense).toBe(false);
    input.table.tick = 20;
    expect(deriveTable(input, { me: owner }).leaks[0]!.canBid).toBe(false);
    input.table.tick = 21;
    expect(deriveTable(input, { me: owner }).leaks[1]!.canOpen).toBe(false);
    input.table.phase = { closing: {} };
    input.table.tick = 160;
    expect(deriveTable(input).ticksLeftInPhase).toBe(20);
    input.table.phase = { xray: {} };
    input.table.tick = 185;
    expect(deriveTable(input).ticksLeftInPhase).toBe(15);
    expect(deriveTable(input, { me: owner }).leaks[1]!.canList).toBe(false);
    input.table.phase = { idle: {} };
    expect(deriveTable(input).secondsLeft).toBe(0);
  });

  it("ships 32 distinct two-word names and handles an unknown index", () => {
    expect(SEAT_NAMES).toHaveLength(32);
    expect(new Set(SEAT_NAMES).size).toBe(32);
    expect(SEAT_NAMES.every((name) => name.split(" ").length === 2)).toBe(true);
    expect(seatName(99)).toBe("Unknown Seat");
  });
});
