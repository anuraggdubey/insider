import { describe, expect, it } from "vitest";

import { decodeOraclePrice } from "../src/oracle.js";

/** The same layout the Rust tests use: both verification-level encodings. */
function feed(raw: bigint, publishTime: number, level: number) {
  const bytes: number[] = new Array(40).fill(0);
  bytes.push(level);
  if (level === 0) bytes.push(0);
  bytes.push(...new Array(32).fill(7));
  const tail = new DataView(new ArrayBuffer(8 + 8 + 4 + 8));
  tail.setBigInt64(0, raw, true);
  tail.setInt32(16, -8, true);
  tail.setBigInt64(20, BigInt(publishTime), true);
  return Uint8Array.from([...bytes, ...new Uint8Array(tail.buffer)]);
}

describe("decodeOraclePrice", () => {
  it("decodes both verification layouts like the program", () => {
    for (const level of [0, 1]) {
      expect(decodeOraclePrice(feed(6_991_000_000n, 1_700_000_000, level))).toEqual({
        usd: 69.91,
        price: 69_910_000,
        publishTime: 1_700_000_000,
      });
    }
  });

  it("rejects short, zero and negative feeds", () => {
    expect(decodeOraclePrice(new Uint8Array(20))).toBeUndefined();
    expect(decodeOraclePrice(feed(0n, 1, 1))).toBeUndefined();
    expect(decodeOraclePrice(feed(-5n, 1, 1))).toBeUndefined();
    expect(decodeOraclePrice(feed(100_000_000n, 1, 1).slice(0, 100))).toBeUndefined();
  });
});
