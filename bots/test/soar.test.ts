import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { planSubmissions } from "../src/soar.js";

const key = () => PublicKey.unique();

describe("planSubmissions", () => {
  it("submits registered players only, floors negative scores at zero and ignores empty slots", () => {
    const a = key();
    const b = key();
    const c = key();
    const plan = planSubmissions(
      [
        { owner: a, score: 1_240n },
        { owner: b, score: -50 },
        { owner: c, score: 900 },
        { owner: PublicKey.default, score: 0 },
      ],
      new Set([a.toBase58(), b.toBase58()]),
    );
    expect(plan.submit.map((s) => [s.owner.toBase58(), s.score])).toEqual([
      [a.toBase58(), 1240],
      [b.toBase58(), 0],
    ]);
    expect(plan.skipped).toEqual([c.toBase58()]);
  });

  it("accepts BN-like scores", () => {
    const a = key();
    const plan = planSubmissions(
      [{ owner: a, score: { toString: () => "77" } }],
      new Set([a.toBase58()]),
    );
    expect(plan.submit[0]!.score).toBe(77);
  });
});
