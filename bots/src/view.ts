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
  /** The auction price while it runs, the asking price once listed. */
  price: number;
  /** What the current owner paid. */
  paid: number;
  /** Price of a licence to read an opened Leak (0 = not offered). */
  licenseAsk: number;
  readerCount: number;
  auctionOver: boolean;
  isMine: boolean;
  isReader: boolean;
};

/** Another seat, as everyone can see it. */
export type SeatView = {
  index: number;
  owned: boolean;
  position: number;
  chips: number;
};

/** An open Desk Call (the direction stays private until it is judged). */
export type CallView = {
  author: number;
  callId: number;
  licenseAsk: number;
  /** Unix seconds. */
  expiry: number;
  readerCount: number;
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
  /** Desk chips and position of this seat. */
  desk: { chips: number; position: number };
  leaks: LeakView[];
  seats: SeatView[];
  calls: CallView[];
  /** Payloads already read for leaks this bot may read, by slot. */
  payloads: Map<number, Payload>;
  /** Directions already read for Calls this bot may read, by author seat (+1 up, -1 down). */
  callDirections: Map<number, 1 | -1>;
};

export type Action =
  | { type: "claim" }
  | { type: "ping" }
  | { type: "bid"; slot: number }
  | { type: "open"; slot: number }
  | { type: "read"; slot: number }
  | { type: "order"; sideSize: number; lane: 0 | 1; note: string }
  | { type: "listLeak"; slot: number; ask: number }
  | { type: "buyListed"; slot: number; seller: number }
  | { type: "offerLicense"; slot: number; ask: number }
  | { type: "buyLicense"; slot: number; owner: number }
  | { type: "buyCallLicense"; author: number }
  | { type: "readCall"; author: number }
  | { type: "deskTrade"; size: number; note: string };
