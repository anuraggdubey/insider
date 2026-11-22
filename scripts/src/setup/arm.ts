/**
 * Arms the tick crank on the TEE. The TEE cannot cancel a task, so the table schedules finite
 * tasks; `rearm_ticks` (permissionless) keeps it alive. This is the operator-side first arming.
 */
import { BN, type Program } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { MAGIC_PROGRAM_ID } from "../lib/config.js";
import {
  MAX_TASK_ITERATIONS,
  SLOTS_PER_TICK,
  TICK_MILLIS,
  type TableAccounts,
} from "../lib/insider.js";

/** Mirrors `REARM_WINDOW_TICKS` in the program: rearm opens when this few ticks of crank remain. */
export const REARM_WINDOW_TICKS = 600;

/** Slots of crank coverage a finite task adds (mirrors `schedule` in `cranks.rs`). */
export const coverageSlots = (intervalMillis: number, iterations: number) =>
  Math.floor((iterations * intervalMillis * SLOTS_PER_TICK) / TICK_MILLIS);

/** True when the crank has less than the rearm window left (or has never been armed). */
export const needsArming = (armedUntilSlot: number, currentSlot: number) =>
  armedUntilSlot <= currentSlot + REARM_WINDOW_TICKS * SLOTS_PER_TICK;

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

/** Schedules one finite tick task (`iterations` at `intervalMillis`). */
export async function armCrank(
  connection: Connection,
  program: Program,
  authority: Keypair,
  accounts: TableAccounts,
  iterations = MAX_TASK_ITERATIONS,
  intervalMillis = TICK_MILLIS,
): Promise<string> {
  const taskId = Date.now() % 1_000_000_000;
  const tx = new Transaction().add(
    await program.methods
      .scheduleTicks(new BN(taskId), new BN(intervalMillis), new BN(iterations))
      .accounts({
        payer: authority.publicKey,
        table: accounts.table,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      // the SDK borrows long-lived accounts, so the same three come again as remaining accounts
      .remainingAccounts([
        meta(authority.publicKey, true, true),
        meta(MAGIC_PROGRAM_ID, false, false),
        meta(accounts.table, false, true),
      ])
      .transaction(),
  );
  return sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });
}
