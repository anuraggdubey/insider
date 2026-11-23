/**
 * The three v1 personas. Each is a pure function of the view and a small memory, so they are
 * unit-tested without a chain. One decision returns the actions to send, in order.
 */
import type { Persona } from "./roster.js";
import { payloadSignal } from "./signal.js";
import type { Action, BotView } from "./view.js";

export type Memory = {
  /** `round:leak` keys already traded on. */
  acted: Set<string>;
  lastBaitTick: number;
  baitSide: 1 | -1;
};

export const newMemory = (): Memory => ({ acted: new Set(), lastBaitTick: -100, baitSide: 1 });

/** Hard limits mirrored from `Params::default()`; a persona never asks for more. */
export const MAX_ORDER = 2_000;
export const MAX_POSITION = 5_000;
export const MAX_PENDING = 4;
/** No new orders this close to the end of the Live phase: they would land in the closeout. */
export const LAST_ORDER_TICK = 150;
/** Most chips a persona pays for one Leak (bankroll is 1,000; Leaks cost 1 to 60). */
const MAX_PRICE = 25;

type Profile = { kinds: number[]; size: number; lane: 0 | 1 };

const PROFILES: Partial<Record<Persona, Profile>> = {
  // pays for order flow and fires on the priority lane to land first
  "front-runner": { kinds: [2, 1, 3, 0], size: 220, lane: 1 },
  // reads aggregate flow and the fundamental, trades the standard lane
  flow: { kinds: [0, 5, 6, 4], size: 160, lane: 0 },
};

const canTrade = (view: BotView, size: number) =>
  view.phase === "live" &&
  view.tick < LAST_ORDER_TICK &&
  !view.seat.liquidated &&
  view.seat.pending < MAX_PENDING - 1 &&
  Math.abs(view.seat.position) + size <= MAX_POSITION &&
  size <= MAX_ORDER;

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

  const profile = PROFILES[persona];
  if (!profile) return [];

  for (const leak of view.leaks) {
    const key = `${view.roundId}:${leak.leakId}`;
    if (leak.isMine && leak.state === 2) {
      actions.push({ type: "open", slot: leak.slot });
    } else if (leak.isReader && leak.state === 4 && !memory.acted.has(key)) {
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
    } else if (
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
