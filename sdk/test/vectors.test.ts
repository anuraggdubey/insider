import { BN } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import vectors from "./fixtures/vectors.json";
import {
  applyFill,
  arbPull,
  auctionOver,
  decodeAccount,
  decodeFuture,
  dutchPrice,
  isqrt,
} from "../src/index.js";

function normalize(value: unknown): unknown {
  if (value instanceof PublicKey) return value.toBase58();
  if (BN.isBN(value)) return (value as BN).toString(10);
  if (Buffer.isBuffer(value)) return [...value];
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

describe("shared Rust vectors", () => {
  it("decodes every field of the Rust zero-copy accounts with Anchor", () => {
    for (const name of ["market", "board", "leakVault", "mempool", "xray"] as const) {
      const decoded = decodeAccount(name, Buffer.from(vectors.raw[name], "base64"));
      expect(normalize(decoded)).toEqual(vectors.expected[name]);
    }
  });

  it("matches the Rust vAMM fills and reserve changes exactly", () => {
    for (const v of vectors.vamm) {
      const fill = applyFill(
        { base: BigInt(v.base), quote: BigInt(v.quote) },
        v.sideSize,
        v.feeBps,
      );
      expect({
        units: fill.units,
        amount: fill.quote.toString(),
        fee: fill.fee.toString(),
        avgPrice: fill.avgPrice,
        newBase: fill.base.toString(),
        newQuote: fill.newQuote.toString(),
      }).toEqual({
        units: v.units,
        amount: v.amount,
        fee: v.fee,
        avgPrice: v.avgPrice,
        newBase: v.newBase,
        newQuote: v.newQuote,
      });
    }
    expect(() => applyFill({ base: 2n, quote: 2n }, 2, 0)).toThrow();
  });

  it("matches Rust arbitrage and Dutch pricing vectors", () => {
    for (const v of vectors.arb) {
      const next = arbPull({ base: BigInt(v.base), quote: BigInt(v.quote) }, v.target, v.bps);
      expect([next.base.toString(), next.quote.toString()]).toEqual([v.newBase, v.newQuote]);
    }
    for (const v of vectors.dutch)
      expect(dutchPrice(v.start, v.floor, v.auctionStart, v.tick)).toBe(v.price);
    for (const [start, floor] of [
      [8, 1],
      [20, 2],
      [60, 6],
    ] as const) {
      expect(dutchPrice(start, floor, 10, 10)).toBe(start);
      expect(dutchPrice(start, floor, 10, 21)).toBe(floor);
    }
    expect(auctionOver(10, 21)).toBe(false);
    expect(auctionOver(10, 22)).toBe(true);
    expect(isqrt((1n << 128n) - 1n)).toBe((1n << 64n) - 1n);
  });

  it("decodes the private Future layout even though it is absent from the IDL", () => {
    const data = Buffer.alloc(816);
    Buffer.from([245, 58, 174, 171, 44, 10, 224, 48]).copy(data);
    data.writeUInt32LE(7, 8);
    data.writeUInt8(1, 12);
    data.writeUInt16LE(22, 16);
    data.writeInt16LE(-200, 18);
    data.writeUInt8(4, 20);
    data.writeUInt32LE(1_234_567, 48);
    const future = decodeFuture(data);
    expect(future.roundId).toBe(7);
    expect(future.shocks[0]).toEqual({ tick: 22, bps: -200, len: 4 });
    expect(future.path[0]).toBe(1_234_567);
    expect(() => decodeFuture(Buffer.alloc(816))).toThrow();
  });
});
