import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  LEAK_SLOTS,
  MAX_TASK_ITERATIONS,
  MARKET_FLOOR,
  SEAT_COUNT,
  SEEDS,
  SLOTS_PER_TICK,
  TICK_MILLIS,
  seatPda,
  tableAccounts,
  tablePda,
} from "../src/lib/insider.js";

const constants = readFileSync(
  new URL("../../programs/insider/src/constants.rs", import.meta.url),
  "utf8",
);
const cranks = readFileSync(
  new URL("../../programs/insider/src/instructions/cranks.rs", import.meta.url),
  "utf8",
);
const rustNumber = (source: string, name: string) =>
  Number(source.match(new RegExp(`pub const ${name}: \\w+ = ([\\d_]+);`))?.[1]?.replace(/_/g, ""));
const rustSeed = (name: string) =>
  constants.match(new RegExp(`pub const ${name}: &\\[u8\\] = b"([a-z]+)";`))?.[1];

describe("insider client mirrors the Rust program", () => {
  it("uses the same constants", () => {
    expect(SLOTS_PER_TICK).toBe(rustNumber(constants, "SLOTS_PER_TICK"));
    expect(SEAT_COUNT).toBe(rustNumber(constants, "SEAT_COUNT"));
    expect(LEAK_SLOTS).toBe(rustNumber(constants, "LEAK_SLOTS"));
    expect(MARKET_FLOOR).toBe(rustNumber(constants, "MARKET_FLOOR"));
    expect(TICK_MILLIS).toBe(rustNumber(constants, "TICK_MILLIS"));
    expect(MAX_TASK_ITERATIONS).toBe(rustNumber(cranks, "MAX_TASK_ITERATIONS"));
  });

  it("uses the same seeds", () => {
    expect(SEEDS.callBook).toBe(rustSeed("CALLBOOK_SEED"));
    expect(SEEDS.season).toBe(rustSeed("SEASON_SEED"));
    expect(SEEDS.seat).toBe(rustSeed("SEAT_SEED"));
    expect(SEEDS.table).toBe(rustSeed("TABLE_SEED"));
    expect(SEEDS.tape).toBe(rustSeed("TAPE_SEED"));
    expect(SEEDS.board).toBe(rustSeed("BOARD_SEED"));
    expect(SEEDS.future).toBe(rustSeed("FUTURE_SEED"));
    expect(SEEDS.leak).toBe(rustSeed("LEAK_SEED"));
    expect(SEEDS.market).toBe(rustSeed("MARKET_SEED"));
    expect(SEEDS.mempool).toBe(rustSeed("MEMPOOL_SEED"));
    expect(SEEDS.xray).toBe(rustSeed("XRAY_SEED"));
  });
});

describe("account derivation", () => {
  const program = new PublicKey("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW");
  const authority = new PublicKey("23k9UnCKBkFyci6Sv1RhuFXUXFgTnjV6oeTZyMaxopWm");

  it("derives one table per authority and ten distinct seats", () => {
    const accounts = tableAccounts(authority, program);
    expect(accounts.table.equals(tablePda(authority, program))).toBe(true);
    expect(accounts.seats).toHaveLength(SEAT_COUNT);
    const keys = new Set(
      [
        accounts.table,
        accounts.tape,
        accounts.callBook,
        accounts.season,
        accounts.market,
        accounts.mempool,
        accounts.future,
        accounts.board,
        accounts.xray,
        ...accounts.vaults,
        ...accounts.seats,
      ].map((k) => k.toBase58()),
    );
    expect(keys.size).toBe(9 + LEAK_SLOTS + SEAT_COUNT);
    expect(accounts.seats[3]!.equals(seatPda(accounts.table, 3, program))).toBe(true);
  });

  it("gives a different table to a different authority", () => {
    const other = new PublicKey("GjuNmqtjs9qHE5M8XiZ516oZmsiQyvRz6JCpFbnT4bcL");
    expect(tablePda(authority, program).equals(tablePda(other, program))).toBe(false);
  });
});
