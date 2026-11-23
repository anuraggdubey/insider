import { describe, expect, it } from "vitest";

import { SLOTS_PER_TICK } from "../src/lib/insider.js";
import {
  ROUNDS_PER_EPOCH,
  VRF_TIMEOUT_TICKS,
  cycleStateFrom,
  nextAction,
  phaseOf,
  vrfTimedOut,
  wallTick,
  type CycleState,
} from "../src/round/cycle.js";

const state = (patch: Partial<CycleState> = {}): CycleState => ({
  phase: "idle",
  roundId: 3,
  roundsThisEpoch: 3,
  vrfPending: false,
  vrfRequestedTick: 0,
  slot: 10_000,
  xrayRoundId: 3,
  xrayFinalized: true,
  readers: 0,
  ...patch,
});

describe("nextAction", () => {
  it("starts the very first round straight away", () => {
    expect(nextAction(state({ roundId: 0, xrayRoundId: 0, xrayFinalized: false }))).toBe(
      "request_round_seed",
    );
  });

  it("leaves a live round alone", () => {
    expect(nextAction(state({ phase: "live" }))).toBe("wait");
    expect(nextAction(state({ phase: "closing" }))).toBe("wait");
  });

  it("scores, reseals, then seeds: in that order", () => {
    expect(nextAction(state({ xrayFinalized: false }))).toBe("finish_round");
    expect(nextAction(state({ readers: 2 }))).toBe("reseal_leaks");
    expect(nextAction(state())).toBe("request_round_seed");
  });

  it("can score during the X-ray window but waits for the clock before the next seed", () => {
    expect(nextAction(state({ phase: "xray", xrayFinalized: false }))).toBe("finish_round");
    expect(nextAction(state({ phase: "xray", readers: 1 }))).toBe("reseal_leaks");
    expect(nextAction(state({ phase: "xray" }))).toBe("wait");
  });

  it("never seeds over a round that was not scored", () => {
    // the X-ray still holds the previous round
    expect(nextAction(state({ xrayRoundId: 2, xrayFinalized: true }))).toBe("finish_round");
  });

  it("waits for the oracle, then cancels a request that never came back", () => {
    const requested = wallTick(10_000);
    const base = state({ phase: "seeding", vrfPending: true, vrfRequestedTick: requested });
    expect(nextAction(base)).toBe("wait");
    const late = 10_000 + VRF_TIMEOUT_TICKS * SLOTS_PER_TICK;
    expect(nextAction({ ...base, slot: late })).toBe("cancel_vrf");
  });

  it("commits the epoch only when epochs are on and the epoch is full", () => {
    const full = state({ roundsThisEpoch: ROUNDS_PER_EPOCH });
    expect(nextAction(full)).toBe("request_round_seed");
    expect(nextAction(full, { epochs: true })).toBe("commit_epoch");
    expect(nextAction(state({ roundsThisEpoch: ROUNDS_PER_EPOCH - 1 }), { epochs: true })).toBe(
      "request_round_seed",
    );
  });
});

describe("the VRF timeout mirrors the program", () => {
  it("uses the truncated rollup clock and survives its wrap-around", () => {
    expect(wallTick(65_536 * SLOTS_PER_TICK)).toBe(0);
    const before = wallTick(65_535 * SLOTS_PER_TICK);
    expect(vrfTimedOut(before, 65_536 * SLOTS_PER_TICK)).toBe(false);
    expect(vrfTimedOut(before, (65_535 + VRF_TIMEOUT_TICKS) * SLOTS_PER_TICK)).toBe(true);
  });
});

describe("cycleStateFrom", () => {
  it("reads the phase name and sums the readers on the board", () => {
    const board = { headers: [{ readerCount: 1 }, { readerCount: 0 }, { readerCount: 2 }] };
    const s = cycleStateFrom(
      {
        phase: { xray: {} },
        roundId: 4,
        roundsThisEpoch: 2,
        vrfPending: false,
        vrfRequestedTick: 7,
        tick: 190,
      },
      board,
      { roundId: 4, finalized: 1 },
      9_000,
    );
    expect(s).toMatchObject({
      phase: "xray",
      roundId: 4,
      readers: 3,
      xrayFinalized: true,
      slot: 9_000,
    });
    expect(nextAction(s)).toBe("reseal_leaks");
  });

  it("rejects a phase it does not know", () => {
    expect(() => phaseOf({ weird: {} })).toThrow();
  });
});
