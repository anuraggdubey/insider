/**
 * The bot personas. Each is a pure function of the view and a small memory, so they are unit-tested
 * without a chain. One decision returns the actions to send, in order.
 *
 *   front-runner  buys order-flow Leaks, reads them and fires on the priority lane
 *   flow          reads aggregate flow and the fundamental, trades the standard lane
 *   baiter        small visible orders that invite a sandwich
 *   copycat       copies whichever seat just moved its position the most (public data only)
 *   flipper       buys Leaks to resell them sealed, licenses the ones it opens, buys licences and
 *                 Desk Call licences from others and trades on what it reads
 */
import type { Persona } from "./roster.js";
import { payloadSignal } from "./signal.js";
import type { Action, BotView } from "./view.js";

export type Memory = {
  /** `round:leak` keys already traded on. */
  acted: Set<string>;
  lastBaitTick: number;
  baitSide: 1 | -1;
  /** Copycat: the positions it saw last time, by seat. */
  seenPositions: Map<number, number>;
  lastCopyTick: number;
  /** Flipper: leaks already listed or offered, and Calls already traded on. */
  handled: Set<string>;
};

export const newMemory = (): Memory => ({
  acted: new Set(),
  lastBaitTick: -100,
  baitSide: 1,
  seenPositions: new Map(),
  lastCopyTick: -100,
  handled: new Set(),
});

/** Hard limits mirrored from `Params::default()`; a persona never asks for more. */
export const MAX_ORDER = 2_000;
export const MAX_POSITION = 5_000;
export const MAX_PENDING = 4;
/** No new orders this close to the end of the Live phase: they would land in the closeout. */
export const LAST_ORDER_TICK = 150;
/** Most chips a persona pays for one Leak (bankroll is 1,000; Leaks cost 1 to 60). */
const MAX_PRICE = 25;
/** Desk limits mirrored from the program. */
const MAX_DESK_ORDER = 500;
const MAX_DESK_POSITION = 2_000;
/** Most a flipper pays for a licence or a listed Leak, in chips. */
const MAX_LICENSE_PRICE = 12;
const MAX_LISTED_PRICE = 20;
const MAX_CALL_LICENSE_PRICE = 30;

type Profile = { kinds: number[]; size: number; lane: 0 | 1 };

const PROFILES: Partial<Record<Persona, Profile>> = {
  // pays for order flow and fires on the priority lane to land first
  "front-runner": { kinds: [2, 1, 3, 0], size: 220, lane: 1 },
  // reads aggregate flow and the fundamental, trades the standard lane
  flow: { kinds: [0, 5, 6, 4], size: 160, lane: 0 },
  // a flipper trades what it reads like a patient flow trader
  flipper: { kinds: [0, 1, 2, 3, 4, 5, 6], size: 140, lane: 0 },
};

const canTrade = (view: BotView, size: number) =>
  view.phase === "live" &&
  view.tick < LAST_ORDER_TICK &&
  !view.seat.liquidated &&
  view.seat.pending < MAX_PENDING - 1 &&
  Math.abs(view.seat.position) + size <= MAX_POSITION &&
  size <= MAX_ORDER;

/** Reads what this seat may read (opened leaks) and turns it into one order, once per leak. */
function readAndTrade(view: BotView, memory: Memory, profile: Profile, actions: Action[]) {
  for (const leak of view.leaks) {
    const key = `${view.roundId}:${leak.leakId}`;
    if (!(leak.isReader && leak.state === 4) || memory.acted.has(key)) continue;
    const payload = view.payloads.get(leak.slot);
    if (!payload) {
      actions.push({ type: "read", slot: leak.slot });
      continue;
    }
    memory.acted.add(key);
    const signal = payloadSignal(payload, view.price);
    if (signal && canTrade(view, profile.size)) {
      const size = Math.max(40, Math.round(profile.size * (0.5 + signal.strength / 2)));
      actions.push({
        type: "order",
        sideSize: signal.side * size,
        lane: profile.lane,
        note: signal.why,
      });
    }
  }
}

function decideCopycat(view: BotView, memory: Memory): Action[] {
  // the seat whose position moved the most since the last look, ignoring this seat
  let leader: { index: number; delta: number } | undefined;
  for (const other of view.seats) {
    if (other.index === view.seat.index || !other.owned) continue;
    const delta = other.position - (memory.seenPositions.get(other.index) ?? other.position);
    memory.seenPositions.set(other.index, other.position);
    if (delta !== 0 && (!leader || Math.abs(delta) > Math.abs(leader.delta))) {
      leader = { index: other.index, delta };
    }
  }
  if (!leader || view.tick - memory.lastCopyTick < 6) return [];
  const size = Math.min(150, Math.max(40, Math.abs(leader.delta)));
  if (!canTrade(view, size)) return [];
  memory.lastCopyTick = view.tick;
  return [
    {
      type: "order",
      sideSize: Math.sign(leader.delta) * size,
      lane: 0,
      note: `copy seat ${leader.index + 1}`,
    },
  ];
}

function decideFlipper(view: BotView, memory: Memory): Action[] {
  const actions: Action[] = [];
  const profile = PROFILES.flipper!;
  const live = view.phase === "live";

  // 1. what this seat owns: flip every other sealed Leak, open the rest and sell licences
  for (const leak of view.leaks) {
    const key = `${view.roundId}:${leak.leakId}`;
    if (leak.isMine && leak.state === 2 && !memory.handled.has(`list:${key}`)) {
      if (leak.leakId % 2 === 0 && live) {
        memory.handled.add(`list:${key}`);
        // resell sealed for about twice what it cost, at least 6 chips
        actions.push({ type: "listLeak", slot: leak.slot, ask: Math.max(6, leak.paid * 2) });
      } else {
        actions.push({ type: "open", slot: leak.slot });
      }
    } else if (
      leak.isMine &&
      leak.state === 4 &&
      leak.licenseAsk === 0 &&
      leak.readerCount < 4 &&
      !memory.handled.has(`offer:${key}`)
    ) {
      memory.handled.add(`offer:${key}`);
      actions.push({ type: "offerLicense", slot: leak.slot, ask: 5 });
    }
  }

  // 2. trade on what it may read (opened by itself or licensed)
  readAndTrade(view, memory, profile, actions);

  // 3. one purchase per decision keeps the unopened limit honest
  if (live && view.seat.unopened < 2 && !actions.some((a) => a.type === "open")) {
    const auction = view.leaks.find(
      (leak) => leak.state === 1 && !leak.auctionOver && leak.price <= 15,
    );
    const listed = view.leaks.find(
      (leak) => leak.state === 3 && !leak.isMine && leak.price <= MAX_LISTED_PRICE,
    );
    const licence = view.leaks.find(
      (leak) =>
        leak.state === 4 &&
        !leak.isMine &&
        !leak.isReader &&
        leak.licenseAsk > 0 &&
        leak.licenseAsk <= MAX_LICENSE_PRICE &&
        leak.readerCount < 4,
    );
    if (licence && view.seat.chips >= licence.licenseAsk) {
      actions.push({ type: "buyLicense", slot: licence.slot, owner: licence.ownerSeat });
    } else if (listed && view.seat.chips >= listed.price) {
      actions.push({ type: "buyListed", slot: listed.slot, seller: listed.ownerSeat });
    } else if (auction && view.seat.chips >= auction.price) {
      actions.push({ type: "bid", slot: auction.slot });
    }
  }

  // 4. the Desk: license somebody else's open Call, then trade the direction it reveals
  for (const call of view.calls) {
    if (call.isMine) continue;
    const key = `call:${call.callId}`;
    if (call.isReader) {
      const direction = view.callDirections.get(call.author);
      if (direction === undefined) {
        actions.push({ type: "readCall", author: call.author });
      } else if (!memory.handled.has(key)) {
        memory.handled.add(key);
        const size = 100 * direction;
        if (
          view.desk.chips > 150 &&
          Math.abs(view.desk.position + size) <= MAX_DESK_POSITION &&
          Math.abs(size) <= MAX_DESK_ORDER
        ) {
          actions.push({ type: "deskTrade", size, note: `call ${call.callId}` });
        }
      }
    } else if (
      call.licenseAsk > 0 &&
      call.licenseAsk <= MAX_CALL_LICENSE_PRICE &&
      call.readerCount < 4 &&
      view.desk.chips >= call.licenseAsk + 150 &&
      !memory.handled.has(`bought:${key}`)
    ) {
      memory.handled.add(`bought:${key}`);
      actions.push({ type: "buyCallLicense", author: call.author });
    }
  }
  return actions;
}

export function decide(persona: Persona, view: BotView, memory: Memory): Action[] {
  if (!view.seat.owned) return [{ type: "claim" }];
  if (view.phase !== "live" && view.phase !== "closing") return [];
  const actions: Action[] = [];

  if (persona === "baiter") {
    // small, visible orders that invite a sandwich; never buys Leaks
    if (canTrade(view, 60) && view.tick - memory.lastBaitTick >= 8 && view.seat.pending < 2) {
      memory.lastBaitTick = view.tick;
      memory.baitSide = memory.baitSide === 1 ? -1 : 1;
      actions.push({ type: "order", sideSize: 60 * memory.baitSide, lane: 0, note: "bait" });
    }
    return actions;
  }
  if (persona === "copycat") return decideCopycat(view, memory);
  if (persona === "flipper") return decideFlipper(view, memory);

  const profile = PROFILES[persona];
  if (!profile) return [];

  for (const leak of view.leaks) {
    if (leak.isMine && leak.state === 2) actions.push({ type: "open", slot: leak.slot });
  }
  readAndTrade(view, memory, profile, actions);
  for (const leak of view.leaks) {
    if (
      leak.state === 1 &&
      !leak.auctionOver &&
      profile.kinds.includes(leak.kind) &&
      view.seat.unopened < 2 &&
      leak.price <= MAX_PRICE &&
      leak.price <= view.seat.chips * 0.1 &&
      view.phase === "live"
    ) {
      actions.push({ type: "bid", slot: leak.slot });
      break; // one purchase per decision keeps the unopened limit honest
    }
  }
  return actions;
}
