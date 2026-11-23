/**
 * What to do next to keep rounds flowing. Pure, so it is unit-tested; the operator script and the
 * bots read the table, the board and the X-ray, ask this, and send the one transaction it names.
 *
 * Round end order (docs/STEPS.md, handoff notes): `finish_round` (scores, X-ray, seat reset), then
 * `reseal_leaks(0, 6)` (readers go back to `nobody`), then `request_round_seed`. At an epoch end
 * `finish_round` also has to run before `commit_epoch`, which writes the season.
 */
import { SLOTS_PER_TICK } from "../lib/insider.js";

export type Phase = "idle" | "seeding" | "live" | "closing" | "xray";

export type CycleState = {
  phase: Phase;
  roundId: number;
  roundsThisEpoch: number;
  vrfPending: boolean;
  /** `vrf_requested_tick`: the rollup clock in ticks, truncated to 16 bits (see `round_seed.rs`). */
  vrfRequestedTick: number;
  /** The current rollup slot. */
  slot: number;
  /** `xray.round_id` and `xray.finalized`. */
  xrayRoundId: number;
  xrayFinalized: boolean;
  /** Readers still on any vault (the sum of every header's `reader_count`). */
  readers: number;
};

export type Action =
  | "wait"
  | "request_round_seed"
  | "cancel_vrf"
  | "finish_round"
  | "reseal_leaks"
  | "commit_epoch";

/** Mirrors `VRF_TIMEOUT_TICKS` and `ROUNDS_PER_EPOCH` in `constants.rs`. */
export const VRF_TIMEOUT_TICKS = 10;
export const ROUNDS_PER_EPOCH = 10;

/** Mirrors `wall_tick` in `round_seed.rs`. */
export const wallTick = (slot: number) => Math.floor(slot / SLOTS_PER_TICK) & 0xffff;

/** Mirrors `vrf_timed_out` in `round_seed.rs`. */
export const vrfTimedOut = (requested: number, slot: number) =>
  ((wallTick(slot) - requested) & 0xffff) >= VRF_TIMEOUT_TICKS;

export type CycleOptions = {
  /** Commit the season at every `ROUNDS_PER_EPOCH` rounds (needs `commit_epoch`, A-3.2). */
  epochs?: boolean;
};

export function nextAction(state: CycleState, options: CycleOptions = {}): Action {
  switch (state.phase) {
    case "seeding":
      if (!state.vrfPending) return "wait";
      return vrfTimedOut(state.vrfRequestedTick, state.slot) ? "cancel_vrf" : "wait";
    case "live":
    case "closing":
      return "wait";
    case "xray":
    case "idle": {
      if (state.roundId > 0) {
        const scored = state.xrayRoundId === state.roundId && state.xrayFinalized;
        if (!scored) return "finish_round";
        if (state.readers > 0) return "reseal_leaks";
        // the round is scored and resealed; during the X-ray window the clock still has to run out
        if (state.phase === "xray") return "wait";
        if (options.epochs && state.roundsThisEpoch >= ROUNDS_PER_EPOCH) return "commit_epoch";
      }
      return "request_round_seed";
    }
  }
}

/** The few fields of the decoded accounts the planner reads (the SDK decoders satisfy this). */
export type DecodedTable = {
  phase: Record<string, unknown>;
  roundId: number;
  roundsThisEpoch: number;
  vrfPending: boolean;
  vrfRequestedTick: number;
  tick: number;
};
export type DecodedBoard = { headers: Array<{ readerCount: number }> };
export type DecodedXray = { roundId: number; finalized: number };

export const phaseOf = (phase: Record<string, unknown>): Phase => {
  const name = Object.keys(phase)[0];
  if (!name || !["idle", "seeding", "live", "closing", "xray"].includes(name)) {
    throw new Error(`unknown phase ${JSON.stringify(phase)}`);
  }
  return name as Phase;
};

/** Builds the planner's input from decoded accounts and the current rollup slot. */
export function cycleStateFrom(
  table: DecodedTable,
  board: DecodedBoard,
  xray: DecodedXray,
  slot: number,
): CycleState {
  return {
    phase: phaseOf(table.phase),
    roundId: table.roundId,
    roundsThisEpoch: table.roundsThisEpoch,
    vrfPending: table.vrfPending,
    vrfRequestedTick: table.vrfRequestedTick,
    slot,
    xrayRoundId: xray.roundId,
    xrayFinalized: xray.finalized !== 0,
    readers: board.headers.reduce((sum, header) => sum + header.readerCount, 0),
  };
}
