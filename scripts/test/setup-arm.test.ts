import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SLOTS_PER_TICK } from "../src/lib/insider.js";
import { REARM_WINDOW_TICKS, coverageSlots, needsArming } from "../src/setup/arm.js";

const cranks = readFileSync(
  new URL("../../programs/insider/src/instructions/cranks.rs", import.meta.url),
  "utf8",
);
const constants = readFileSync(
  new URL("../../programs/insider/src/constants.rs", import.meta.url),
  "utf8",
);

describe("crank arming", () => {
  it("uses the same rearm window as the program", () => {
    const rust = Number(constants.match(/REARM_WINDOW_TICKS: u64 = (\d+);/)?.[1]);
    expect(REARM_WINDOW_TICKS).toBe(rust);
    expect(cranks).toContain("REARM_WINDOW_TICKS * SLOTS_PER_TICK");
  });

  it("a 1,200-tick task covers ten minutes", () => {
    // 1,200 ticks of 500 ms = 600 s = 60,000 slots at 100 slots per second
    expect(coverageSlots(500, 1_200)).toBe(1_200 * SLOTS_PER_TICK);
    expect(coverageSlots(500, 1_200)).toBe(60_000);
  });

  it("needs arming when it was never armed or is about to run out", () => {
    expect(needsArming(0, 1_000_000)).toBe(true);
    const window = REARM_WINDOW_TICKS * SLOTS_PER_TICK;
    expect(needsArming(1_000_000 + window, 1_000_000)).toBe(true);
    expect(needsArming(1_000_000 + window + 1, 1_000_000)).toBe(false);
  });
});
