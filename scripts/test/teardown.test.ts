import { describe, expect, it } from "vitest";

import { RECOVERY_KIND, allRecoveryTargets, type RecoveryTarget } from "@insider/sdk";

import { GROUP_BYTES, planGroups, type Sized } from "../src/teardown.js";

const table: RecoveryTarget = { kind: RECOVERY_KIND.table, slot: 0 };
/** Account sizes as they are on chain (discriminator included). */
const SIZE: Record<number, number> = {
  [RECOVERY_KIND.table]: 118,
  [RECOVERY_KIND.tape]: 913,
  [RECOVERY_KIND.callBook]: 1_848,
  [RECOVERY_KIND.season]: 1_057,
  [RECOVERY_KIND.market]: 832,
  [RECOVERY_KIND.cup]: 260,
  [RECOVERY_KIND.mempool]: 464,
  [RECOVERY_KIND.future]: 816,
  [RECOVERY_KIND.board]: 1_032,
  [RECOVERY_KIND.xray]: 7_284,
  [RECOVERY_KIND.leakVault]: 304,
  [RECOVERY_KIND.callVault]: 16,
  [RECOVERY_KIND.seat]: 107,
};
const sized = (targets: RecoveryTarget[]): Sized[] =>
  targets.map((target) => ({ target, size: SIZE[target.kind]! }));
const bytes = (group: RecoveryTarget[]) => group.reduce((sum, t) => sum + SIZE[t.kind]!, 0);

describe("planGroups", () => {
  it("takes the whole table in groups that respect the count and the byte budget, the table last", () => {
    const groups = planGroups(sized(allRecoveryTargets()));
    expect(groups.flat()).toHaveLength(allRecoveryTargets().length);
    for (const group of groups) {
      expect(group.length).toBeLessThanOrEqual(8);
      // a group over the budget is a single big account that goes alone
      if (bytes(group) > GROUP_BYTES) expect(group).toHaveLength(1);
    }
    expect(groups.flat().at(-1)).toEqual(table);
    expect(groups.flat().filter((t) => t.kind === RECOVERY_KIND.table)).toHaveLength(1);
  });

  it("never groups the combinations the TEE refused (six leak vaults, the old first group)", () => {
    const six = Array.from({ length: 6 }, (_, slot) => ({ kind: RECOVERY_KIND.leakVault, slot }));
    const groups = planGroups(sized(six));
    expect(groups.map((g) => g.length)).toEqual([4, 2]);
    const first = allRecoveryTargets().slice(0, 8);
    expect(planGroups(sized(first)).length).toBeGreaterThan(1);
    // the 7 KB X-ray is alone: it passed on its own
    const xray = planGroups(sized(first)).find((g) => g.some((t) => t.kind === RECOVERY_KIND.xray));
    expect(xray).toEqual([{ kind: RECOVERY_KIND.xray, slot: 0 }]);
  });

  it("gives the table its own group when the last one has no room, and handles small or empty sets", () => {
    const eight = Array.from({ length: 8 }, (_, slot) => ({ kind: RECOVERY_KIND.callVault, slot }));
    expect(planGroups(sized([...eight, table])).map((g) => g.length)).toEqual([8, 1]);
    expect(planGroups(sized([table]))).toEqual([[table]]);
    expect(planGroups([])).toEqual([]);
    // what is still delegated after a partial run: six seats and the table fit one group
    const left = [4, 5, 6, 7, 8, 9].map((slot) => ({ kind: RECOVERY_KIND.seat, slot }));
    expect(planGroups(sized([...left, table]))).toEqual([[...left, table]]);
  });
});
