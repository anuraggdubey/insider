/**
 * G8 Epoch cycle: can an account be committed (while staying delegated), then committed and
 * undelegated, then re-delegated, repeatedly? This is how `Season` settles at the end of an epoch.
 */
import { MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID } from "../lib/config.js";
import { waitFor } from "../lib/rpc.js";
import {
  Gate,
  closePermission,
  context,
  delegateProbe,
  readProbe,
  resetProbe,
  runIfMain,
  send,
  undelegateProbe,
} from "./lib.js";

const CYCLES = 3;

export async function run() {
  const gate = new Gate("G8", "Epoch cycle");
  const ctx = context(gate);
  await resetProbe(ctx);

  const cycles: Array<Record<string, unknown>> = [];
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n  cycle ${cycle}`);
    const started = performance.now();
    const session = await delegateProbe(ctx, "tee");
    const delegatedMs = Math.round(performance.now() - started);

    const sendSecret = async (value: number) =>
      send(
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
    const onBase = async () => (await readProbe(ctx.base, ctx.baseProgram, ctx.probe))?.secret;

    // 1. commit while staying delegated: the base layer must see the value
    const mid = cycle * 100 + 1;
    await sendSecret(mid);
    const commitStart = performance.now();
    await send(
      gate,
      session.er,
      await session.erProgram.methods
        .probeCommit()
        .accounts({
          payer: ctx.payer.publicKey,
          probe: ctx.probe,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        })
        .transaction(),
      [ctx.payer],
      "probe_commit (stay delegated)",
      "TEE",
      session.endpoint,
    );
    // a delegated account is owned by the delegation program on base, so read its raw data
    const rawSecret = async () => {
      const info = await ctx.base.getAccountInfo(ctx.probe);
      return info
        ? (ctx.baseProgram.coder.accounts.decode("probe", info.data) as { secret: number }).secret
        : undefined;
    };
    const committed = await waitFor(
      "commit to land on base",
      async () => ((await rawSecret()) === mid ? true : undefined),
      { timeoutMs: 45_000 },
    ).catch(() => false);
    const commitMs = Math.round(performance.now() - commitStart);

    // 2. final write, then commit and undelegate
    const last = cycle * 100 + 2;
    await sendSecret(last);
    const undelegateStart = performance.now();
    await closePermission(ctx, session).catch(() => undefined);
    await undelegateProbe(ctx, session);
    const undelegateMs = Math.round(performance.now() - undelegateStart);
    const final = await onBase();
    cycles.push({
      cycle,
      delegatedMs,
      commitStayedDelegated: committed,
      commitMs,
      undelegateMs,
      baseSecretAfterUndelegate: final,
      expected: last,
      ok: committed && final === last,
    });
    console.log(`  cycle ${cycle}: ${JSON.stringify(cycles.at(-1))}`);
  }
  gate.note("cycles", cycles);

  const allOk = cycles.every((c) => c.ok);
  if (allOk) {
    return gate.finish(
      "pass",
      `Committed, undelegated and re-delegated ${CYCLES} times in a row with the right value on base each time. The epoch design stands.`,
    );
  }
  return gate.finish(
    "cut",
    "A commit or undelegate cycle failed: Season commits become one-shot and cadence is reduced.",
  );
}

runIfMain(import.meta.url, run);
