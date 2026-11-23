import { describe, expect, it } from "vitest";

import { evaluate, findFrontRun, type XrayView } from "../src/sim/checks.js";

const cast = { alice: 7, bob: 8, carol: 9 };
const leak = (ownerSeat: number, state = 4) => ({ state, readerCount: 1, ownerSeat });

const good = (): XrayView => ({
  roundId: 5,
  finalized: true,
  orders: [
    { seat: 8, lane: 0, sideSize: 600, sentTick: 20, landTick: 40 },
    { seat: 7, lane: 1, sideSize: 400, sentTick: 23, landTick: 27 },
  ],
  leaks: [leak(7), leak(9), ...Array.from({ length: 6 }, () => leak(254, 5))],
  tagCount: 1,
});

describe("findFrontRun", () => {
  it("needs a later send that lands first on the priority lane", () => {
    expect(findFrontRun(good().orders, 7, 8)).toBeDefined();
    // sent earlier than the victim: that is just an early order
    const early = [good().orders[0]!, { ...good().orders[1]!, sentTick: 10, landTick: 14 }];
    expect(findFrontRun(early, 7, 8)).toBeUndefined();
    // lands after the victim: the lane did not help
    const slow = [good().orders[0]!, { ...good().orders[1]!, landTick: 45 }];
    expect(findFrontRun(slow, 7, 8)).toBeUndefined();
    // the standard lane never counts
    const standard = [good().orders[0]!, { ...good().orders[1]!, lane: 0 }];
    expect(findFrontRun(standard, 7, 8)).toBeUndefined();
  });
});

describe("evaluate", () => {
  it("passes a complete round", () => {
    const checks = evaluate(good(), cast, 5);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
  });

  it("names what is missing", () => {
    const failing = (patch: Partial<XrayView>, round = 5) =>
      evaluate({ ...good(), ...patch }, cast, round).filter((c) => !c.pass).map((c) => c.name);
    expect(failing({ finalized: false })).toHaveLength(1);
    expect(failing({}, 6)).toHaveLength(1);
    expect(failing({ leaks: good().leaks.slice(0, 5) })[0]).toMatch(/eight drops/);
    expect(failing({ orders: [] })).toEqual([
      "Bob's order landed",
      "Alice front-ran Bob on the priority lane",
    ]);
    expect(failing({ leaks: good().leaks.map((l) => ({ ...l, ownerSeat: 254, state: 5, readerCount: 0 })) })).toEqual([
      "Alice and Carol bought Leaks",
      "Leaks were opened",
    ]);
  });
});
