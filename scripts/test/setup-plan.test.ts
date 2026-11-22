import { describe, expect, it } from "vitest";

import {
  DELEGATIONS_PER_TX,
  SEATS_PER_INIT_TX,
  chunk,
  describeTarget,
  emptyState,
  isComplete,
  planSetup,
  type TableState,
} from "../src/setup/plan.js";

const done = (): TableState => {
  const state = emptyState();
  for (const key of ["table", "tape", "callBook", "season"] as const) {
    state[key] = { exists: true, delegated: true };
  }
  state.seats = state.seats.map(() => ({ exists: true, delegated: true }));
  return state;
};

const count = (batches: ReturnType<typeof planSetup>, kind: "init" | "delegate") =>
  batches.flatMap((b) => b.steps).filter((s) => s.kind === kind).length;

describe("chunk", () => {
  it("splits evenly and keeps the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("rejects a size below one", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("planSetup from scratch", () => {
  const batches = planSetup(emptyState());

  it("creates the table first, alone", () => {
    expect(batches[0]!.steps).toEqual([{ kind: "init", target: "table" }]);
  });

  it("creates the three big accounts in one transaction after the table", () => {
    expect(batches[1]!.steps.map((s) => describeTarget(s.target))).toEqual([
      "tape",
      "callBook",
      "season",
    ]);
  });

  it("creates ten seats, five per transaction", () => {
    const seatBatches = batches.filter((b) => b.label.startsWith("create seats"));
    expect(seatBatches).toHaveLength(2);
    seatBatches.forEach((b) => expect(b.steps).toHaveLength(SEATS_PER_INIT_TX));
    expect(count(batches, "init")).toBe(1 + 3 + 10);
  });

  it("delegates all fourteen accounts, six per transaction, table first and season last", () => {
    const delegations = batches.filter((b) => b.label.startsWith("delegate"));
    expect(count(batches, "delegate")).toBe(14);
    delegations.forEach((b) => expect(b.steps.length).toBeLessThanOrEqual(DELEGATIONS_PER_TX));
    expect(delegations).toHaveLength(3);
    const flat = delegations.flatMap((b) => b.steps.map((s) => describeTarget(s.target)));
    expect(flat[0]).toBe("table");
    expect(flat.at(-1)).toBe("season");
  });

  it("never delegates before everything is created", () => {
    const firstDelegate = batches.findIndex((b) => b.label.startsWith("delegate"));
    const lastInit = batches.map((b) => b.label).lastIndexOf("create seats (2/2)");
    expect(firstDelegate).toBeGreaterThan(lastInit);
  });
});

describe("planSetup resumes", () => {
  it("plans nothing when everything is created and delegated", () => {
    expect(planSetup(done())).toEqual([]);
    expect(isComplete(done())).toBe(true);
  });

  it("plans only the missing seats", () => {
    const state = done();
    state.seats[7] = { exists: false, delegated: false };
    state.seats[8] = { exists: false, delegated: false };
    const batches = planSetup(state);
    expect(count(batches, "init")).toBe(2);
    expect(count(batches, "delegate")).toBe(2);
  });

  it("plans only the delegation when everything exists but is not delegated yet", () => {
    const state = done();
    for (const key of ["table", "tape", "callBook", "season"] as const) {
      state[key].delegated = false;
    }
    state.seats.forEach((seat) => (seat.delegated = false));
    const batches = planSetup(state);
    expect(count(batches, "init")).toBe(0);
    expect(count(batches, "delegate")).toBe(14);
  });

  it("continues a half-finished delegation without repeating finished accounts", () => {
    const state = done();
    state.season.delegated = false;
    state.seats[9]!.delegated = false;
    const batches = planSetup(state);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.steps.map((s) => describeTarget(s.target))).toEqual(["seat 9", "season"]);
  });
});
