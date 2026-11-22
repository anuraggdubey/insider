import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { DEFAULT_TARGET, SOL, TREASURY_RESERVE, planFunding } from "../src/funding.js";
import { keyPath, loadAll, loadOrCreate } from "../src/keys.js";
import { ROSTER, membersFor, seatKind } from "../src/roster.js";

describe("roster", () => {
  it("fits the seat classes of the program", () => {
    for (const member of ROSTER) expect(seatKind(member.seat)).toBe(member.kind);
  });

  it("gives every member a distinct seat and key file", () => {
    expect(new Set(ROSTER.map((m) => m.seat)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((m) => m.id)).size).toBe(ROSTER.length);
  });

  it("ships three personas in v1 and all seven later", () => {
    expect(membersFor("v1").map((m) => m.persona)).toEqual(["front-runner", "flow", "baiter"]);
    expect(membersFor("all")).toHaveLength(7);
  });
});

describe("keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "insider-keys-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("creates a key once and reloads the same one", () => {
    const member = ROSTER[0]!;
    const first = loadOrCreate(dir, member);
    const second = loadOrCreate(dir, member);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.keypair.publicKey.equals(first.keypair.publicKey)).toBe(true);
    expect(JSON.parse(readFileSync(keyPath(dir, member), "utf8"))).toHaveLength(64);
  });

  it("gives every member a different key", () => {
    const all = loadAll(dir, ROSTER);
    expect(new Set(all.map((a) => a.keypair.publicKey.toBase58())).size).toBe(ROSTER.length);
  });
});

describe("funding plan", () => {
  it("tops wallets up to the target and skips funded ones", () => {
    const plan = planFunding(
      [
        { name: "a", balance: 0 },
        { name: "b", balance: DEFAULT_TARGET },
        { name: "c", balance: 0.02 * SOL },
      ],
      5 * SOL,
    );
    expect(plan.transfers).toEqual([
      { name: "a", lamports: DEFAULT_TARGET },
      { name: "c", lamports: DEFAULT_TARGET - 0.02 * SOL },
    ]);
    expect(plan.short).toEqual([]);
  });

  it("ignores tiny shortfalls", () => {
    const plan = planFunding([{ name: "a", balance: DEFAULT_TARGET - 1_000 }], 5 * SOL);
    expect(plan.transfers).toEqual([]);
  });

  it("never spends the treasury reserve and reports who stays short", () => {
    const wallets = ["a", "b", "c"].map((name) => ({ name, balance: 0 }));
    const plan = planFunding(wallets, TREASURY_RESERVE + 2 * DEFAULT_TARGET);
    expect(plan.transfers.map((t) => t.name)).toEqual(["a", "b"]);
    expect(plan.short.map((t) => t.name)).toEqual(["c"]);
    expect(plan.total).toBe(2 * DEFAULT_TARGET);
  });

  it("funds nobody when the treasury is at or below its reserve", () => {
    const plan = planFunding([{ name: "a", balance: 0 }], TREASURY_RESERVE);
    expect(plan.transfers).toEqual([]);
    expect(plan.short).toHaveLength(1);
  });
});
