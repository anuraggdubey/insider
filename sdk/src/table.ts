import { PublicKey } from "@solana/web3.js";
import type {
  BoardAccount,
  MarketAccount,
  SeatAccount,
  TableAccount,
  TapeAccount,
  XrayAccount,
} from "./accounts";
import {
  BANKROLL_CHIPS,
  CLOSING_END_TICK,
  LANE_PRIORITY,
  LEAK_SLOTS,
  LIVE_TICKS,
  NO_SEAT,
  PRICE_ONE,
  ROUND_TICKS,
  SLOTS_PER_TICK,
  TICK_MILLIS,
  WHALE_SEAT,
} from "./constants";
import { seatName } from "./names";
import { auctionOver, dutchPrice } from "./vamm";

export type LocalOrder = {
  id: string;
  sideSize: number;
  lane: number;
  sentTick: number;
  landTick: number;
  round: number;
};
const ZERO = PublicKey.default;
const bigint = (value: { toString(): string } | number) => BigInt(value.toString());
const enumName = (value: object) => Object.keys(value)[0] ?? "unknown";
const kinds = [
  "Flow",
  "Spotlight",
  "Whale",
  "Full Book",
  "Pin",
  "Drift",
  "Shockwave",
  "Summit",
] as const;
const rarities = ["Common", "Rare", "Epic"] as const;
const states = ["Empty", "Auction", "Owned", "Listed", "Opened", "Expired"] as const;

function ring<T>(entries: T[], head: number): T[] {
  const count = Math.min(head, entries.length);
  return Array.from({ length: count }, (_, i) => entries[(head - 1 - i) % entries.length]!);
}

export function deriveTable(
  input: {
    table: TableAccount;
    market: MarketAccount;
    board: BoardAccount;
    seats: SeatAccount[];
    tape: TapeAccount;
    xray?: XrayAccount | null;
  },
  options: { me?: PublicKey; pending?: LocalOrder[]; nowSlot?: number } = {},
) {
  const { table, market, board, tape } = input;
  const phase = enumName(table.phase);
  const tick = table.tick;
  const phaseEnd =
    phase === "live"
      ? LIVE_TICKS
      : phase === "closing"
        ? CLOSING_END_TICK
        : phase === "xray"
          ? ROUND_TICKS
          : tick;
  const ticksLeftInPhase = Math.max(0, phaseEnd - tick);
  const elapsedSlots =
    options.nowSlot === undefined
      ? 0
      : Math.max(0, options.nowSlot - Number(bigint(table.roundStartSlot)));
  const fraction =
    options.nowSlot === undefined ? 0 : (elapsedSlots % SLOTS_PER_TICK) / SLOTS_PER_TICK;
  const sends = ring(tape.sends, tape.sendsHead);
  const fills = ring(tape.fills, tape.fillsHead);
  const seats = input.seats.map((seat) => {
    const chips = bigint(seat.chips);
    const equity = chips + (BigInt(seat.position) * BigInt(market.price)) / BigInt(PRICE_ONE);
    const latest = sends.find((event) => event.seat === seat.index);
    return {
      index: seat.index,
      name: seatName(seat.nameIdx),
      kind: enumName(seat.kind),
      owner: seat.owner,
      isFree: seat.owner.equals(ZERO),
      isMe: Boolean(options.me?.equals(seat.owner)),
      position: seat.position,
      chips: Number(chips),
      equity: Number(equity),
      pnl: Number(equity - BigInt(BANKROLL_CHIPS)),
      liquidated: Boolean(market.liquidatedMask & (1 << seat.index)),
      lastSeenTick: seat.lastSeenTick,
      lastSend: latest ? { lane: latest.lane, tick: latest.sentTick } : undefined,
    };
  });
  const mine = seats.find((seat) => seat.isMe);
  const unopened = board.headers.filter(
    (header) => header.ownerSeat === mine?.index && (header.state === 2 || header.state === 3),
  ).length;
  const activePhase = (phase === "live" || phase === "closing") && board.roundId === table.roundId;
  const leaks = board.headers.slice(0, LEAK_SLOTS).map((header, slot) => {
    const currentPrice =
      header.state === 1
        ? dutchPrice(header.startPrice, header.floorPrice, header.auctionStart, tick)
        : header.ask;
    const isMine = mine !== undefined && header.ownerSeat === mine.index;
    const isReader =
      options.me !== undefined &&
      header.readers
        .slice(0, header.readerCount)
        .some((reader: PublicKey) => reader.equals(options.me!));
    const validWindow = tick <= header.windowEnd;
    const canBid = Boolean(
      activePhase &&
      mine &&
      header.state === 1 &&
      !auctionOver(header.auctionStart, tick) &&
      unopened < 2 &&
      mine.chips >= currentPrice,
    );
    return {
      ...header,
      slot,
      kindName: kinds[header.kind] ?? "Unknown",
      rarityName: rarities[header.rarity] ?? "Unknown",
      stateName: states[header.state] ?? "Unknown",
      family: header.kind < 4 ? "Flow" : "Fundamentals",
      currentPrice,
      ticksLeft: Math.max(
        0,
        (header.state === 1 ? header.auctionStart + 12 : header.windowEnd + 1) - tick,
      ),
      isMine,
      isReader,
      canBid,
      canOpen: Boolean(activePhase && isMine && header.state === 2 && validWindow),
      canList: Boolean(activePhase && isMine && (header.state === 2 || header.state === 3)),
      canBuy: Boolean(
        activePhase &&
        mine &&
        !isMine &&
        header.state === 3 &&
        validWindow &&
        header.ask > 0 &&
        unopened < 2 &&
        mine.chips >= header.ask,
      ),
      canLicense: Boolean(
        activePhase &&
        mine &&
        !isReader &&
        !isMine &&
        header.state === 4 &&
        validWindow &&
        header.licenseAsk > 0 &&
        header.readerCount < 4 &&
        mine.chips >= header.licenseAsk,
      ),
    };
  });
  const feed = [
    ...sends.map((event, order) => ({
      type: "send" as const,
      tick: event.sentTick,
      seat: event.seat,
      lane: event.lane,
      order,
    })),
    ...fills.map((event, order) => ({
      type: "fill" as const,
      tick: event.landedTick,
      seat: event.seat,
      side: event.side,
      size: event.size,
      price: event.price,
      order,
    })),
  ].sort((a, b) => b.tick - a.tick || a.order - b.order);
  return {
    phase,
    tick,
    ticksLeftInPhase,
    secondsLeft: Math.max(0, ((ticksLeftInPhase - fraction) * TICK_MILLIS) / 1000),
    round: table.roundId,
    price: market.price,
    priceSeries: market.history
      .slice(0, Math.min(tick + 1, market.history.length))
      .flatMap((value, pointTick) => (value === 0 ? [] : [{ tick: pointTick, value }])),
    seats,
    leaks,
    feed,
    mine,
    myPending: (options.pending ?? [])
      .filter((order) => order.round === table.roundId && order.landTick > tick)
      .map((order) => ({ ...order, ticksToLand: order.landTick - tick })),
    whaleSeat: WHALE_SEAT,
    noSeat: NO_SEAT,
    priorityLane: LANE_PRIORITY,
  };
}

export type TableView = ReturnType<typeof deriveTable>;
