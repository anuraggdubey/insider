import { readFileSync } from "node:fs";
import { BN, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import idl from "../../programs/idl/insider.json" with { type: "json" };
import { MAGIC_PROGRAM_ID } from "../src/lib/config.js";
import {
  LEAK_SLOTS,
  SEAT_COUNT,
  SLOTS_PER_TICK,
  insiderProgram,
  tableAccounts,
  tickAccountList,
} from "../src/lib/insider.js";
import {
  REARM_WINDOW_TICKS,
  coverageSlots,
  needsArming,
  scheduleRemaining,
} from "../src/setup/arm.js";

const cranks = readFileSync(
  new URL("../../programs/insider/src/instructions/cranks.rs", import.meta.url),
  "utf8",
);
const constants = readFileSync(
  new URL("../../programs/insider/src/constants.rs", import.meta.url),
  "utf8",
);

describe("crank arming", () => {
  it("uses the same rearm window as the program", () => {
    const rust = Number(constants.match(/REARM_WINDOW_TICKS: u64 = (\d+);/)?.[1]);
    expect(REARM_WINDOW_TICKS).toBe(rust);
    expect(cranks).toContain("REARM_WINDOW_TICKS * SLOTS_PER_TICK");
  });

  it("a 1,200-tick task covers ten minutes", () => {
    // 1,200 ticks of 500 ms = 600 s = 60,000 slots at 100 slots per second
    expect(coverageSlots(500, 1_200)).toBe(1_200 * SLOTS_PER_TICK);
    expect(coverageSlots(500, 1_200)).toBe(60_000);
  });

  it("needs arming when it was never armed or is about to run out", () => {
    expect(needsArming(0, 1_000_000)).toBe(true);
    const window = REARM_WINDOW_TICKS * SLOTS_PER_TICK;
    expect(needsArming(1_000_000 + window, 1_000_000)).toBe(true);
    expect(needsArming(1_000_000 + window + 1, 1_000_000)).toBe(false);
  });
});

describe("the accounts the scheduled tick receives", () => {
  const authority = Keypair.generate();
  const accounts = tableAccounts(authority.publicKey);
  const idlTick = (idl as Idl).instructions.find((ix) => ix.name === "tick")!;

  it("lists the named accounts first, then the vaults, then the seats, as the program expects", () => {
    // `tick` names table, scheduler, crank signer, then market ... tape; vaults and seats follow
    const named = idlTick.accounts.map((a) => a.name);
    expect(named).toEqual([
      "table",
      "scheduler",
      "crank_signer",
      "market",
      "mempool",
      "future",
      "board",
      "xray",
      "tape",
    ]);
    const list = tickAccountList(accounts);
    expect(list.slice(0, 6)).toEqual([
      accounts.market,
      accounts.mempool,
      accounts.future,
      accounts.board,
      accounts.xray,
      accounts.tape,
    ]);
    expect(list.slice(6, 12)).toEqual(accounts.vaults);
    expect(list.slice(12)).toEqual(accounts.seats);
    expect(list).toHaveLength(6 + LEAK_SLOTS + SEAT_COUNT);
  });

  it("marks everything writable except the future", () => {
    const metas = scheduleRemaining(authority.publicKey, accounts);
    expect(metas.slice(0, 3).map((m) => m.isWritable)).toEqual([true, false, true]);
    for (const meta of metas.slice(3)) {
      expect(meta.isWritable).toBe(!meta.pubkey.equals(accounts.future));
    }
  });

  it("fits the arming transaction into one packet", async () => {
    const program = insiderProgram(new Connection("http://127.0.0.1:1"), authority);
    const tx = await program.methods
      .scheduleTicks(new BN(1), new BN(500), new BN(1_200))
      .accounts({
        payer: authority.publicKey,
        table: accounts.table,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .remainingAccounts(scheduleRemaining(authority.publicKey, accounts))
      .transaction();
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = PublicKey.default.toBase58();
    tx.partialSign(authority);
    expect(tx.serialize().length).toBeLessThanOrEqual(1232);
  });
});
