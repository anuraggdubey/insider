import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import * as legacy from "../../scripts/src/lib/insider.js";
import {
  BANKROLL_CHIPS,
  CLOSING_END_TICK,
  createConfig,
  DROPS_PER_ROUND,
  DROP_EVERY_TICKS,
  FIRST_DROP_TICK,
  MAX_LIVE_LEAKS,
  LANE_PRIORITY,
  LANE_STANDARD,
  LEAK_SLOTS,
  LIVE_TICKS,
  NO_SEAT,
  PATH_LEN,
  PRICE_ONE,
  ROUND_TICKS,
  SEAT_COUNT,
  SEEDS,
  SLOTS_PER_TICK,
  TICK_MILLIS,
  WHALE_SEAT,
  callBookPda,
  seatPda,
  seasonPda,
  tableAccounts,
  tablePda,
  tapePda,
  insiderProgram,
} from "../src/index.js";

const constants = readFileSync(
  new URL("../../programs/insider/src/constants.rs", import.meta.url),
  "utf8",
);
const rustSeed = (name: string) =>
  constants.match(new RegExp(`pub const ${name}: &\\[u8\\] = b"([a-z]+)";`))?.[1];
const rustNumber = (name: string) =>
  Number(
    constants.match(new RegExp(`pub const ${name}: \\w+ = ([\\d_]+);`))?.[1]?.replace(/_/g, ""),
  );

describe("program constants and PDAs", () => {
  it("mirrors Rust seeds and numeric constants", () => {
    for (const [key, name] of Object.entries({
      board: "BOARD",
      callBook: "CALLBOOK",
      future: "FUTURE",
      leak: "LEAK",
      market: "MARKET",
      mempool: "MEMPOOL",
      nobody: "NOBODY",
      season: "SEASON",
      seat: "SEAT",
      table: "TABLE",
      tape: "TAPE",
      xray: "XRAY",
    }))
      expect(SEEDS[key as keyof typeof SEEDS]).toBe(rustSeed(`${name}_SEED`));
    for (const [name, value] of Object.entries({
      BANKROLL_CHIPS,
      CLOSING_END_TICK,
      DROPS_PER_ROUND,
      DROP_EVERY_TICKS,
      FIRST_DROP_TICK,
      MAX_LIVE_LEAKS,
      LANE_PRIORITY,
      LANE_STANDARD,
      LEAK_SLOTS,
      LIVE_TICKS,
      NO_SEAT,
      PATH_LEN,
      PRICE_ONE,
      ROUND_TICKS,
      SEAT_COUNT,
      SLOTS_PER_TICK,
      TICK_MILLIS,
      WHALE_SEAT,
    }))
      expect(value).toBe(rustNumber(name));
  });

  it("matches the existing script's PDA helpers", () => {
    const authority = Keypair.generate().publicKey;
    const program = new PublicKey("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW");
    const table = tablePda(authority, program);
    expect(table.equals(legacy.tablePda(authority, program))).toBe(true);
    expect(tapePda(table, program).equals(legacy.tapePda(table, program))).toBe(true);
    expect(callBookPda(table, program).equals(legacy.callBookPda(table, program))).toBe(true);
    expect(seasonPda(table, program).equals(legacy.seasonPda(table, program))).toBe(true);
    for (let i = 0; i < SEAT_COUNT; i++)
      expect(seatPda(table, i, program).equals(legacy.seatPda(table, i, program))).toBe(true);
    const all = tableAccounts(authority, program);
    expect(all.leakVaults).toHaveLength(LEAK_SLOTS);
    expect(all.floor.equals(all.desk)).toBe(false);
  });
});

describe("configuration", () => {
  it("has devnet defaults and honors overrides", () => {
    const defaults = createConfig();
    expect(defaults.baseRpcUrl).toBe("https://api.devnet.solana.com");
    expect(defaults.programId.toBase58()).toBe("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW");
    const tableAuthority = Keypair.generate().publicKey;
    const config = createConfig({ baseRpcUrl: "https://rpc.example", tableAuthority });
    expect(config.baseRpcUrl).toBe("https://rpc.example");
    expect(config.tableAuthority).toBe(tableAuthority);
    expect(config.routerUrl).toBe(defaults.routerUrl);
  });

  it("exposes the generated IDL's typed methods and respects a program override", () => {
    const programId = Keypair.generate().publicKey;
    const program = insiderProgram(
      new Connection("https://api.devnet.solana.com"),
      Keypair.generate(),
      programId,
    );
    expect(program.programId.equals(programId)).toBe(true);
    expect(typeof program.methods.sendOrder).toBe("function");
    expect(program.methods.sendOrder(0, 1, 0)).toBeDefined();
  });
});
