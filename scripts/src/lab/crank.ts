/**
 * Spike D: crank-driven ticks inside the rollup.
 * Schedules `lab_tick` on an interval and checks that it runs, that only the scheduler can call it,
 * and that cancelling stops it.
 * Usage: pnpm lab:crank [--validator er|tee]
 */
import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";

import { Run, send } from "../lib/client.js";
import { MAGIC_PROGRAM_ID, parseValidatorArg } from "../lib/config.js";
import { delegateLab, labContext, readLab, resetLab, undelegateLab } from "../lib/lab.js";
import { sleep } from "../lib/rpc.js";

const TASK_CONTEXT = new PublicKey("TaskContext11111111111111111111111111111111");

async function main() {
  const kind = parseValidatorArg(process.argv);
  const run = new Run(`lab-crank-${kind}`);
  const ctx = labContext(run);
  run.note("lab", ctx.lab.toBase58());

  await resetLab(ctx);
  const session = await delegateLab(ctx, kind);
  const { er, erProgram, layer, endpoint } = session;
  const ticks = async () => (await readLab(er, erProgram, ctx.lab))!.ticks.toNumber();
  const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
    pubkey,
    isSigner,
    isWritable,
  });
  const opts = (step: string, signers?: Keypair[]) => ({
    run,
    step,
    layer,
    erUrl: endpoint,
    signers,
  });

  const schedule = async (taskId: number, intervalMs: number, iterations: number) =>
    send(
      er,
      ctx.payer,
      await erProgram.methods
        .labScheduleTick(new BN(taskId), new BN(intervalMs), new BN(iterations))
        .accounts({ authority: ctx.payer.publicKey, lab: ctx.lab, magicProgram: MAGIC_PROGRAM_ID })
        .remainingAccounts([
          meta(ctx.payer.publicKey, true, true),
          meta(MAGIC_PROGRAM_ID, false, false),
          meta(ctx.lab, false, true),
        ])
        .transaction(),
      opts(`lab_schedule_tick task ${taskId} (${iterations}x ${intervalMs}ms)`),
    );

  // 1. a finite task: schedule 6 ticks, 500 ms apart, and watch them arrive
  const taskA = Date.now() % 1_000_000_000;
  const before = await ticks();
  const scheduledAt = performance.now();
  await schedule(taskA, 500, 6);
  const timeline: Array<{ atMs: number; ticks: number }> = [];
  let reached = before;
  while (performance.now() - scheduledAt < 25_000 && reached < before + 6) {
    reached = await ticks();
    timeline.push({ atMs: Math.round(performance.now() - scheduledAt), ticks: reached - before });
    await sleep(500);
  }
  run.note("finiteTask", { expected: 6, observed: reached - before, timeline });

  // 2. the scheduled instruction must not be callable by anyone else
  const impostor = Keypair.generate();
  let directCall = "accepted (BAD)";
  try {
    await send(
      er,
      ctx.payer,
      await erProgram.methods
        .labTick()
        .accounts({ lab: ctx.lab, crankSigner: impostor.publicKey })
        .transaction(),
      opts("lab_tick called directly (expected to fail)", [impostor]),
    );
  } catch (error) {
    directCall = `rejected: ${(error as Error).message.slice(0, 100)}`;
  }
  run.note("directTickCall", directCall);

  // 3. a long task, then cancel it and confirm it stops
  const taskB = taskA + 1;
  // the TEE has no task context account, so cancel is unavailable there: use a finite task
  await schedule(taskB, 300, kind === "tee" ? 10 : 500);
  const base = await ticks();
  const grew = await (async () => {
    const started = performance.now();
    while (performance.now() - started < 15_000) {
      if ((await ticks()) >= base + 3) return true;
      await sleep(300);
    }
    return false;
  })();
  let cancelError: string | undefined;
  try {
    await send(
      er,
      ctx.payer,
      await erProgram.methods
        .labCancelTick(new BN(taskB))
        .accounts({
          authority: ctx.payer.publicKey,
          taskContext: TASK_CONTEXT,
          magicProgram: MAGIC_PROGRAM_ID,
        })
        .remainingAccounts([
          meta(ctx.payer.publicKey, true, true),
          meta(TASK_CONTEXT, false, true),
          meta(MAGIC_PROGRAM_ID, false, false),
        ])
        .transaction(),
      opts(`lab_cancel_tick task ${taskB}`),
    );
  } catch (error) {
    cancelError = (error as Error).message.replace(/\s+/g, " ").slice(0, 160);
  }
  await sleep(2_000); // allow the scheduler to apply the cancel
  const afterCancel = await ticks();
  await sleep(4_000);
  const later = await ticks();
  run.note("cancel", {
    supported: cancelError === undefined,
    error: cancelError ?? null,
    ticksGrewBeforeCancel: grew,
    ticksAfterCancelSettled: afterCancel,
    ticksFourSecondsLater: later,
    stopped: later === afterCancel,
  });

  await undelegateLab(ctx, session);
  const onBase = await readLab(ctx.base, ctx.baseProgram, ctx.lab);
  run.note("ticksOnBase", onBase!.ticks.toNumber());
  run.writeProof();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
