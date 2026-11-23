import { describe, expect, it } from "vitest";

import {
  DELEGATIONS_PER_TX,
  ENGINE_PER_INIT_TX,
  SINGLE_ACCOUNTS,
  emptyPermissions,
  planPermissions,
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
  for (const key of SINGLE_ACCOUNTS) {
    state[key] = { exists: true, delegated: true };
  }
  state.vaults = state.vaults.map(() => ({ exists: true, delegated: true }));
  state.callVaults = state.callVaults.map(() => ({ exists: true, delegated: true }));
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
    expect(count(batches, "init")).toBe(1 + 3 + 23 + 10);
  });

  it("delegates all thirty-seven accounts, five per transaction, table first and season last", () => {
    const delegations = batches.filter((b) => b.label.startsWith("delegate"));
    expect(count(batches, "delegate")).toBe(37);
    delegations.forEach((b) => expect(b.steps.length).toBeLessThanOrEqual(DELEGATIONS_PER_TX));
    expect(delegations).toHaveLength(8);
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
    state.vaults.forEach((vault) => (vault.delegated = false));
    state.callVaults.forEach((vault) => (vault.delegated = false));
    for (const key of SINGLE_ACCOUNTS) {
      state[key].delegated = false;
    }
    state.seats.forEach((seat) => (seat.delegated = false));
    const batches = planSetup(state);
    expect(count(batches, "init")).toBe(0);
    expect(count(batches, "delegate")).toBe(37);
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

describe("engine accounts in the plan", () => {
  const batches = planSetup(emptyState());

  it("creates both markets, mempool, future, board, X-ray, six vaults and ten call vaults, three per transaction", () => {
    const engine = batches.filter((b) => b.label.startsWith("create engine accounts"));
    expect(engine).toHaveLength(8);
    engine.forEach((b) => expect(b.steps.length).toBeLessThanOrEqual(ENGINE_PER_INIT_TX));
    expect(engine.flatMap((b) => b.steps.map((s) => describeTarget(s.target)))).toEqual([
      "market",
      "desk",
      "cup",
      "mempool",
      "future",
      "board",
      "xray",
      "vault 0",
      "vault 1",
      "vault 2",
      "vault 3",
      "vault 4",
      "vault 5",
      ...Array.from({ length: 10 }, (_, i) => `call vault ${i}`),
    ]);
  });

  it("plans only a missing vault, and delegates it once it exists", () => {
    const state = done();
    state.vaults[3] = { exists: false, delegated: false };
    expect(
      planSetup(state).map((b) => b.steps.map((s) => `${s.kind} ${describeTarget(s.target)}`)),
    ).toEqual([["init vault 3"], ["delegate vault 3"]]);
  });
});

describe("planPermissions", () => {
  it("makes the mempool, the future, six vaults and ten call vaults private, four per transaction", () => {
    const plan = planPermissions(emptyPermissions());
    expect(plan.map((b) => b.targets.length)).toEqual([4, 4, 4, 4, 2]);
    expect(plan.flatMap((b) => b.targets)).toEqual([
      "mempool",
      "future",
      ...[0, 1, 2, 3, 4, 5].map((vault) => ({ vault })),
      ...Array.from({ length: 10 }, (_, callVault) => ({ callVault })),
    ]);
  });

  it("skips what is private already and is empty when all are", () => {
    const state = emptyPermissions();
    state.mempool = true;
    state.vaults = state.vaults.map((_, i) => i < 5);
    state.callVaults = state.callVaults.map(() => true);
    expect(planPermissions(state).flatMap((b) => b.targets)).toEqual(["future", { vault: 5 }]);
    const all = {
      mempool: true,
      future: true,
      vaults: state.vaults.map(() => true),
      callVaults: state.callVaults.map(() => true),
    };
    expect(planPermissions(all)).toEqual([]);
  });
});
