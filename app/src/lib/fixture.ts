import { BN, utils } from "@anchor-lang/core";
import {
  applyFill,
  arbPull,
  BANKROLL_CHIPS,
  decodeAccount,
  dutchPrice,
  LANE_PRIORITY,
  LANE_STANDARD,
  PRICE_ONE,
  WHALE_SEAT,
  type LeakVaultAccount,
  type LocalOrder,
  type TableSnapshot,
  vammPrice,
} from "@insider/sdk";
import { PublicKey } from "@solana/web3.js";
import vectors from "../../../sdk/test/fixtures/vectors.json";
import {
  buildFixturePayload,
  makeFixtureDrop,
  type FixtureDrop,
  type FixtureShock,
} from "./fixture-leaks";

const zero = PublicKey.default;
const bn = (value: number | bigint) => new BN(value.toString());
const account = <K extends "market" | "board" | "leakVault" | "xray">(name: K) =>
  decodeAccount(name, utils.bytes.base64.decode(vectors.raw[name]));

export type Fixture = {
  snapshot: TableSnapshot;
  vaults: Record<number, LeakVaultAccount>;
  queue: (LocalOrder & { seat: number })[];
  seq: number;
  drops: FixtureDrop[];
  path: number[];
  shocks: FixtureShock[];
  sandwich: {
    slot: number;
    front: number;
    victim: number;
    sideSize: number;
    frontTick: number;
    victimTick: number;
  } | null;
};

export function createFixture(): Fixture {
  let randomState = 15;
  const below = (limit: number) => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) % limit;
  };
  const drops = Array.from({ length: 8 }, (_, i) => makeFixtureDrop(10 + i * 20, below));
  const shocks = [
    { tick: 45, bps: 120 },
    { tick: 112, bps: -160 },
  ];
  const path = Array.from(
    { length: 192 },
    (_, tick) =>
      PRICE_ONE +
      Math.round(12_000 * Math.sin(tick / 20)) +
      shocks.filter((shock) => tick >= shock.tick).reduce((sum, shock) => sum + shock.bps * 100, 0),
  );
  const market = account("market");
  market.roundId = 1;
  market.base = bn(50_000);
  market.quote = bn(50_000);
  market.price = PRICE_ONE;
  market.markPrice = PRICE_ONE;
  market.lastTick = 0;
  market.history.fill(0);
  market.history[0] = PRICE_ONE;
  market.liquidatedMask = 0;
  const board = account("board");
  board.roundId = 1;
  board.dropIndex = 0;
  board.nextLeakId = 1;
  for (const header of board.headers) {
    header.state = 0;
    header.ownerSeat = 254;
  }
  const xray = account("xray");
  xray.roundId = 1;
  xray.finalized = 0;
  xray.orderCount = 0;
  xray.leakCount = 0;
  xray.tagCount = 0;
  xray.seatOwners.fill(zero);
  xray.scores.fill(0);
  xray.seatKinds.fill(0);
  xray.nameIdx.fill(0);
  xray.seatPad.fill(0);
  const table = {
    authority: new PublicKey(new Uint8Array(32).fill(1)),
    epoch: 0,
    roundId: 1,
    phase: { live: {} },
    roundStartSlot: bn(0),
    tick: 0,
    armedUntilSlot: bn(0),
    vrfNonce: 0,
    vrfPending: false,
    vrfRequestedTick: 0,
    roundsThisEpoch: 0,
    params: {
      arbBps: 400,
      feeBps: 10,
      priorityFee: 3,
      standardDelay: 20,
      priorityDelay: 4,
      maxOrderUnits: 2_000,
      maxPositionUnits: 5_000,
      maxPending: 4,
      vammBase: bn(50_000),
      vammQuote: bn(50_000),
    },
    bump: 0,
  } as TableSnapshot["table"];
  const positions = [150, -200, 300, -100, 450, -250, 100, 0, 0, 0];
  const seats = positions.map((position, index) => ({
    index,
    owner: index < 7 ? new PublicKey(new Uint8Array(32).fill(index + 10)) : zero,
    nameIdx: index,
    kind: index < 5 ? { bot: {} } : index < 7 ? { ai: {} } : { human: {} },
    chips: bn(1_000 - position),
    position,
    entry: bn(PRICE_ONE),
    feesPaid: bn(0),
    leakSpend: bn(0),
    pendingCount: 0,
    deskChips: bn(0),
    deskPosition: 0,
    lastSeenTick: 0,
    claims: 0,
    bump: 0,
  })) as TableSnapshot["seats"];
  const tape = {
    sends: Array.from({ length: 64 }, () => ({ seat: 0, lane: 0, sentTick: 0 })),
    sendsHead: 0,
    fills: Array.from({ length: 64 }, () => ({
      seat: 0,
      side: 0,
      size: 0,
      price: 0,
      landedTick: 0,
    })),
    fillsHead: 0,
    bump: 0,
  } as TableSnapshot["tape"];
  return {
    snapshot: { table, market, desk: null, board, tape, seats, xray, season: null, callBook: null },
    vaults: {},
    queue: [43, 86, 129].map((landTick, index) => ({
      id: `${index + 1}`,
      seat: WHALE_SEAT,
      sideSize: [1800, -2200, 2600][index]!,
      lane: LANE_STANDARD,
      sentTick: 0,
      landTick,
      round: 1,
    })),
    seq: 3,
    drops,
    path,
    shocks,
    sandwich: null,
  };
}

function pushSend(fixture: Fixture, seat: number, lane: number, tick: number) {
  const tape = fixture.snapshot.tape;
  tape.sends[tape.sendsHead++ % 64] = { seat, lane, sentTick: tick };
}

export function fixtureClaim(fixture: Fixture, owner: PublicKey, index: number) {
  const seat = fixture.snapshot.seats[index]!;
  seat.owner = owner;
  const bytes = owner.toBytes();
  seat.nameIdx = (bytes[0]! ^ bytes[15]! ^ bytes[31]!) % 32;
  seat.chips = bn(1_000);
  seat.position = 0;
  seat.lastSeenTick = fixture.snapshot.table.tick;
}

export function fixtureSend(
  fixture: Fixture,
  index: number,
  sideSize: number,
  lane: number,
): LocalOrder {
  const { table, seats } = fixture.snapshot;
  if (lane === LANE_PRIORITY)
    seats[index]!.chips = bn(
      BigInt(seats[index]!.chips.toString()) - BigInt(table.params.priorityFee),
    );
  const order = {
    id: `${++fixture.seq}`,
    sideSize,
    lane,
    sentTick: table.tick,
    landTick:
      table.tick +
      (lane === LANE_PRIORITY ? table.params.priorityDelay : table.params.standardDelay),
    round: table.roundId,
    seat: index,
  };
  fixture.queue.push(order);
  seats[index]!.pendingCount++;
  pushSend(fixture, index, lane, table.tick);
  return order;
}

function archive(fixture: Fixture, slot: number) {
  const { board, xray } = fixture.snapshot;
  const header = board.headers[slot]!;
  const vault = fixture.vaults[slot];
  if (
    !xray ||
    !vault ||
    xray.leakCount >= xray.leaks.length ||
    xray.leaks.slice(0, xray.leakCount).some((leak) => leak.header.leakId === header.leakId)
  )
    return;
  const entry = xray.leaks[xray.leakCount++]!;
  entry.header = { ...header, readers: [...header.readers] };
  entry.fields = [...vault.fields];
  entry.orders = vault.orders.map((order) => ({ ...order }));
  entry.orderCount = vault.orderCount;
}

export function fixtureTick(fixture: Fixture) {
  const { table, market, board, seats, tape, xray } = fixture.snapshot;
  const tick = table.tick + 1;
  table.tick = tick;
  table.phase =
    tick < 160
      ? { live: {} }
      : tick < 180
        ? { closing: {} }
        : tick < 200
          ? { xray: {} }
          : { idle: {} };
  if (tick > 200) return;
  if (tick === 31) {
    const slot = board.headers.findIndex((header) => header.state === 1 && header.kind === 1);
    const target = slot < 0 ? undefined : fixture.vaults[slot]?.orders[0];
    if (target && target.sideSize !== 0 && target.seat < 7 && target.landTick > tick + 4) {
      const front = (target.seat + 1) % 7;
      const size = Math.sign(target.sideSize) * Math.min(200, Math.abs(target.sideSize));
      fixtureBid(fixture, front, slot);
      const header = board.headers[slot]!;
      header.state = 4;
      header.openedTick = tick;
      header.readers[0] = seats[front]!.owner;
      header.readerCount = 1;
      fixtureSend(fixture, front, size, LANE_PRIORITY);
      fixture.sandwich = {
        slot,
        front,
        victim: target.seat,
        sideSize: size,
        frontTick: tick + 4,
        victimTick: target.landTick,
      };
    }
  }
  if (fixture.sandwich?.victimTick === tick) {
    fixtureSend(fixture, fixture.sandwich.front, -fixture.sandwich.sideSize, LANE_PRIORITY);
  }
  const fills: { seat: number; size: number; lane: number; sentTick: number; landTick: number }[] =
    [];
  if (tick < 140 && tick % 9 === 1) {
    const seat = Math.floor(tick / 9) % 7;
    const size = (Math.floor(tick / 9) % 3 === 0 ? -1 : 1) * (100 + (tick % 5) * 50);
    const lane = tick % 4 === 1 ? LANE_PRIORITY : LANE_STANDARD;
    fixtureSend(fixture, seat, size, lane);
  }
  const landed = fixture.queue.filter((order) => order.landTick === tick);
  for (const order of landed)
    fills.push({
      seat: order.seat,
      size: order.sideSize,
      lane: order.lane,
      sentTick: order.sentTick,
      landTick: order.landTick,
    });
  fixture.queue = fixture.queue.filter((order) => order.landTick > tick);
  for (const fill of fills) {
    const result = applyFill(
      { base: BigInt(market.base.toString()), quote: BigInt(market.quote.toString()) },
      fill.size,
      table.params.feeBps,
    );
    market.base = bn(result.base);
    market.quote = bn(result.newQuote);
    market.price = Number((result.newQuote * BigInt(1_000_000)) / result.base);
    if (fill.seat !== WHALE_SEAT) {
      const seat = seats[fill.seat]!;
      const old = BigInt(seat.chips.toString());
      seat.chips = bn(old + (fill.size > 0 ? -result.quote : result.quote) - result.fee);
      seat.position += fill.size;
      if (seat.pendingCount > 0) seat.pendingCount--;
    }
    tape.fills[tape.fillsHead++ % 64] = {
      seat: fill.seat,
      side: fill.size > 0 ? 1 : -1,
      size: Math.abs(fill.size),
      price: result.avgPrice,
      landedTick: tick,
    };
    if (xray && xray.orderCount < xray.orders.length) {
      xray.orders[xray.orderCount++] = {
        seat: fill.seat,
        lane: fill.lane,
        sideSize: fill.size,
        sentTick: fill.sentTick,
        landTick: fill.landTick,
        fillPrice: result.avgPrice,
      };
    }
  }
  const pulled = arbPull(
    { base: BigInt(market.base.toString()), quote: BigInt(market.quote.toString()) },
    fixture.path[Math.min(tick, fixture.path.length - 1)]!,
    table.params.arbBps,
  );
  market.base = bn(pulled.base);
  market.quote = bn(pulled.quote);
  market.price = vammPrice(pulled);
  if (tick < market.history.length) market.history[tick] = market.price;
  market.lastTick = tick;
  if (tick <= 150 && tick >= 10 && (tick - 10) % 20 === 0) {
    const drop = fixture.drops[board.dropIndex++]!;
    const live = board.headers.filter((header) => header.state >= 1 && header.state <= 4).length;
    const slot =
      live >= 4
        ? -1
        : board.headers.findIndex(
            (header) =>
              header.state === 0 ||
              (header.state === 5 && header.readerCount === 0 && tick > header.windowEnd),
          );
    if (slot >= 0) {
      const h = board.headers[slot]!;
      if (h.state === 5) archive(fixture, slot);
      const vault = account("leakVault");
      const { windowStart, windowEnd } = buildFixturePayload(
        drop,
        fixture.queue,
        fixture.path,
        fixture.shocks,
        vault,
      );
      Object.assign(h, {
        leakId: board.nextLeakId++,
        kind: drop.kind,
        rarity: drop.rarity,
        state: 1,
        ownerSeat: 254,
        windowStart,
        windowEnd,
        mintedTick: tick,
        auctionStart: tick,
        startPrice: [8, 20, 60][drop.rarity]!,
        floorPrice: [1, 2, 6][drop.rarity]!,
        paid: 0,
        ask: 0,
        licenseAsk: 0,
        openedTick: 0,
        flips: 0,
        readerCount: 0,
        readers: [zero, zero, zero, zero],
      });
      vault.leakId = h.leakId;
      vault.roundId = table.roundId;
      vault.slot = slot;
      fixture.vaults[slot] = vault;
    }
  }
  for (const h of board.headers)
    if (
      (h.state === 1 && tick >= h.auctionStart + 12) ||
      (h.state >= 2 && h.state <= 4 && tick > h.windowEnd)
    )
      h.state = 5;
  if (tick === 180) {
    for (const seat of seats) {
      seat.chips = bn(
        BigInt(seat.chips.toString()) +
          (BigInt(seat.position) * BigInt(market.price)) / BigInt(PRICE_ONE),
      );
      seat.position = 0;
      seat.entry = bn(0);
      seat.pendingCount = 0;
    }
    fixture.queue = [];
  }
  if (tick === 181 && xray) {
    board.headers.forEach((header, slot) => {
      if (header.state !== 0) archive(fixture, slot);
    });
    const candidate = fixture.sandwich;
    if (candidate) {
      const orders = xray.orders.slice(0, xray.orderCount);
      const front = orders.find(
        (o) => o.seat === candidate.front && o.landTick === candidate.frontTick,
      );
      const victim = orders.find(
        (o) => o.seat === candidate.victim && o.landTick === candidate.victimTick,
      );
      const exit = orders.find(
        (o) => o.seat === candidate.front && o.landTick === candidate.victimTick + 4,
      );
      if (front && victim && exit) {
        const pnl =
          Math.trunc(
            ((exit.fillPrice - front.fillPrice) *
              Math.min(Math.abs(front.sideSize), Math.abs(exit.sideSize))) /
              PRICE_ONE,
          ) * Math.sign(front.sideSize);
        xray.tags[xray.tagCount++] = {
          front: candidate.front,
          victim: candidate.victim,
          leakSlot: candidate.slot,
          pad: 0,
          frontTick: candidate.frontTick,
          victimTick: candidate.victimTick,
          profitEstimate: pnl,
        };
      }
    }
    for (const seat of seats) {
      const index = seat.index;
      xray.seatOwners[index] = seat.owner;
      xray.scores[index] = seat.owner.equals(zero)
        ? 0
        : Number(BigInt(seat.chips.toString()) - BigInt(BANKROLL_CHIPS));
      xray.seatKinds[index] = "bot" in seat.kind ? 0 : "ai" in seat.kind ? 1 : 2;
      xray.nameIdx[index] = seat.nameIdx;
      seat.chips = bn(BANKROLL_CHIPS);
      seat.feesPaid = bn(0);
      seat.leakSpend = bn(0);
    }
    xray.finalized = 1;
  }
}

export function fixtureBid(fixture: Fixture, index: number, slot: number) {
  const { table, board, seats } = fixture.snapshot;
  const header = board.headers[slot]!;
  const price = dutchPrice(header.startPrice, header.floorPrice, header.auctionStart, table.tick);
  if (header.state !== 1 || table.tick >= header.auctionStart + 12)
    throw new Error("Auction has ended.");
  if (BigInt(seats[index]!.chips.toString()) < BigInt(price)) throw new Error("Not enough chips.");
  seats[index]!.chips = bn(BigInt(seats[index]!.chips.toString()) - BigInt(price));
  seats[index]!.leakSpend = bn(BigInt(seats[index]!.leakSpend.toString()) + BigInt(price));
  Object.assign(header, { ownerSeat: index, state: 2, paid: price });
}
