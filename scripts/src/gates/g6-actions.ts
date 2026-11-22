/**
 * G6 Magic Action: can a post-commit action fire a base-layer instruction of our program?
 *
 * `probe_commit_with_action` commits the probe from the TEE and attaches `probe_log_action`. The
 * delegation program runs the action on the base layer, paid from the payer's escrow, and it
 * writes the committed value into a base-layer `ActionLog`. The SOAR leaderboard call is not part
 * of this script.
 */
import {
  createTopUpEscrowInstruction,
  escrowPdaFromEscrowAuthority,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, Transaction } from "@solana/web3.js";

import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID } from "../lib/config.js";
import { waitFor } from "../lib/rpc.js";
import {
  GATES_PROGRAM_ID,
  Gate,
  closePermission,
  context,
  delegateProbe,
  resetProbe,
  runIfMain,
  send,
  undelegateProbe,
} from "./lib.js";

const logPda = PublicKey.findProgramAddressSync([Buffer.from("action_log")], GATES_PROGRAM_ID)[0];

export async function run() {
  const gate = new Gate("G6", "Magic Action");
  const ctx = context(gate);
  gate.note("actionLog", logPda.toBase58());

  // base layer: the log the action will write
  if (!(await ctx.base.getAccountInfo(logPda))) {
    await send(
      gate,
      ctx.base,
      await ctx.baseProgram.methods
        .probeInitLog()
        .accounts({ payer: ctx.payer.publicKey, log: logPda })
        .transaction(),
      [ctx.payer],
      "probe_init_log",
      "base",
    );
  }
  const readLog = async () => {
    const info = await ctx.base.getAccountInfo(logPda);
    return info
      ? (ctx.baseProgram.coder.accounts.decode("actionLog", info.data) as {
          count: number;
          lastSecret: number;
          lastSends: number;
        })
      : undefined;
  };
  const before = (await readLog())!;

  // base layer: fund the escrow that pays for the action
  const [escrow] = [escrowPdaFromEscrowAuthority(ctx.payer.publicKey, 255)];
  gate.note("escrow", escrow.toBase58());
  await send(
    gate,
    ctx.base,
    new Transaction().add(
      createTopUpEscrowInstruction(
        escrow,
        ctx.payer.publicKey,
        ctx.payer.publicKey,
        20_000_000,
        255,
      ),
    ),
    [ctx.payer],
    "top up action escrow (0.02 SOL)",
    "base",
  );

  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");
  const value = 4242;
  await send(
    gate,
    session.er,
    await session.erProgram.methods
      .probeSendSecret(value)
      .accounts({ sender: ctx.payer.publicKey, probe: ctx.probe })
      .transaction(),
    [ctx.payer],
    `probe_send_secret ${value}`,
    "TEE",
    session.endpoint,
  );
  await send(
    gate,
    session.er,
    await session.erProgram.methods
      .probeCommitWithAction()
      .accounts({
        payer: ctx.payer.publicKey,
        probe: ctx.probe,
        log: logPda,
        programId: GATES_PROGRAM_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .transaction(),
    [ctx.payer],
    "probe_commit_with_action",
    "TEE",
    session.endpoint,
  );

  const started = performance.now();
  const after = await waitFor(
    "the action to write the base-layer log",
    async () => {
      const log = await readLog();
      return log && log.count > before.count ? log : undefined;
    },
    { timeoutMs: 60_000, intervalMs: 1_500 },
  ).catch(() => undefined);
  gate.note("actionLatencyMs", Math.round(performance.now() - started));
  gate.note("logBefore", before);
  gate.note("logAfter", after ?? null);
  gate.note("soar", "not tested in this script");

  await closePermission(ctx, session).catch(() => undefined);
  await undelegateProbe(ctx, session);

  if (after && after.lastSecret === value) {
    return gate.finish(
      "info",
      "Magic Action works: a post-commit action ran our base-layer instruction, authenticated by the escrow signer, and wrote the committed value. The SOAR leaderboard call is not yet tested, so achievements stay undecided until task A-4.2.",
    );
  }
  return gate.finish(
    "cut",
    "The post-commit action did not run on the base layer: Magic Action and achievements are cut.",
  );
}

runIfMain(import.meta.url, run);
