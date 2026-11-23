/** Decoded accounts to the plain `BotView` a persona decides on. Pure, so it is unit-tested. */
import type { PublicKey } from "@solana/web3.js";

import { phaseOf } from "@insider/sdk";

import type { Payload } from "./signal.js";
import type { BotView, LeakView } from "./view.js";

const num = (value: { toString(): string } | number) => Number(value.toString());

/** Dutch price, mirrors `math/dutch.rs` (12-tick auction falling from start to floor). */
export const DUTCH_TICKS = 12;
export const dutchPrice = (start: number, floor: number, auctionStart: number, tick: number) => {
  const elapsed = Math.min(DUTCH_TICKS - 1, Math.max(0, tick - auctionStart));
  return start - Math.floor((Math.max(0, start - floor) * elapsed) / (DUTCH_TICKS - 1));
};

export type Decoded = {
  table: { roundId: number; tick: number; phase: Record<string, unknown> };
  market: { price: number };
  board: {
    roundId: number;
    headers: Array<{
      leakId: number;
      kind: number;
      rarity: number;
      state: number;
      ownerSeat: number;
      auctionStart: number;
      startPrice: number;
      floorPrice: number;
      ask: number;
      readerCount: number;
      readers: PublicKey[];
    }>;
  };
  seat: {
    index: number;
    owner: PublicKey;
    chips: { toString(): string } | number;
    position: number;
    pendingCount: number;
  };
  liquidated: boolean;
};

export function buildView(decoded: Decoded, me: PublicKey, payloads: Map<number, Payload>): BotView {
  const { table, market, board, seat } = decoded;
  const tick = table.tick;
  const index = seat.index;
  const leaks: LeakView[] = board.headers.map((header, slot) => {
    const state = header.state;
    const price = state === 1 ? dutchPrice(header.startPrice, header.floorPrice, header.auctionStart, tick) : header.ask;
    return {
      slot,
      leakId: header.leakId,
      kind: header.kind,
      rarity: header.rarity,
      state,
      ownerSeat: header.ownerSeat,
      price,
      auctionOver: Math.max(0, tick - header.auctionStart) >= DUTCH_TICKS,
      isMine: header.ownerSeat === index,
      isReader: header.readers.slice(0, header.readerCount).some((reader) => reader.equals(me)),
    };
  });
  // leaks of an older round stay on the board until the next seed: only this round's count
  const current = board.roundId === table.roundId ? leaks : [];
  return {
    roundId: table.roundId,
    tick,
    phase: phaseOf(table.phase),
    price: market.price / 1_000_000,
    seat: {
      index,
      owned: seat.owner.equals(me),
      chips: num(seat.chips),
      position: seat.position,
      pending: seat.pendingCount,
      unopened: current.filter((leak) => leak.isMine && (leak.state === 2 || leak.state === 3)).length,
      liquidated: decoded.liquidated,
    },
    leaks: current,
    payloads,
  };
}
