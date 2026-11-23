/** What a bot sees each decision: plain numbers, built from the decoded accounts. */
import type { Payload } from "./signal.js";

export type LeakView = {
  slot: number;
  leakId: number;
  kind: number;
  rarity: number;
  /** 0 empty, 1 auction, 2 owned, 3 listed, 4 opened, 5 expired. */
  state: number;
  ownerSeat: number;
  price: number;
  auctionOver: boolean;
  isMine: boolean;
  isReader: boolean;
};

export type BotView = {
  roundId: number;
  tick: number;
  phase: "idle" | "seeding" | "live" | "closing" | "xray";
  price: number;
  seat: {
    index: number;
    owned: boolean;
    chips: number;
    position: number;
    pending: number;
    unopened: number;
    liquidated: boolean;
  };
  leaks: LeakView[];
  /** Payloads already read for leaks this bot may read, by slot. */
  payloads: Map<number, Payload>;
};

export type Action =
  | { type: "claim" }
  | { type: "ping" }
  | { type: "bid"; slot: number }
  | { type: "open"; slot: number }
  | { type: "read"; slot: number }
  | { type: "order"; sideSize: number; lane: 0 | 1; note: string };
