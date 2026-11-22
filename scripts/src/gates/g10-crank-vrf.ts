/**
 * G10 Crank-invoked VRF (optional): can a crank-scheduled instruction request VRF?
 * First a control: a wallet-signed request on the TEE must complete. Then the same request is
 * scheduled on the crank, where the crank signer PDA is the payer. Passing makes per-drop VRF an
 * enhancement; failing changes nothing (drops stay derived from the round seed).
 */
import { waitFor } from "../lib/rpc.js";
import {
  EPHEMERAL_QUEUE,
  Gate,
  closePermission,
  context,
  delegateProbe,
  readProbe,
  resetProbe,
  runIfMain,
  scheduleCrank,
  send,
  undelegateProbe,
} from "./lib.js";

export async function run() {
  const gate = new Gate("G10", "Crank-invoked VRF");
  const ctx = context(gate);
  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");
  const calls = async () => (await readProbe(session.er, session.erProgram, ctx.probe))!.vrfCalls;

  // control: a wallet-signed request completes through the callback
  const base = await calls();
  const started = performance.now();
  await send(
    gate,
    session.er,
    await session.erProgram.methods
      .probeRequestVrf(1)
      .accounts({ payer: ctx.payer.publicKey, probe: ctx.probe, oracleQueue: EPHEMERAL_QUEUE })
      .transaction(),
    [ctx.payer],
    "probe_request_vrf (wallet)",
    "TEE",
    session.endpoint,
  );
  const controlOk = await waitFor(
    "wallet VRF callback",
    async () => ((await calls()) > base ? true : undefined),
    { timeoutMs: 20_000 },
  ).catch(() => false);
  gate.note("walletRequest", {
    callbackArrived: controlOk,
    ms: Math.round(performance.now() - started),
  });

  // the real question: the crank signer PDA as payer
  const beforeCrank = await calls();
  let scheduleError: string | undefined;
  try {
    await scheduleCrank(
      ctx,
      session,
      { taskId: Date.now() % 1_000_000_000, intervalMs: 2_000, iterations: 3, vrf: true },
      "probe_schedule (VRF target, 3 x 2 s)",
    );
  } catch (error) {
    scheduleError = (error as Error).message.replace(/\s+/g, " ").slice(0, 200);
    gate.note("scheduleRejected", scheduleError);
  }
  const crankOk = scheduleError
    ? false
    : await waitFor(
        "crank-requested VRF callback",
        async () => ((await calls()) > beforeCrank ? true : undefined),
        { timeoutMs: 25_000 },
      ).catch(() => false);
  const finalCalls = await calls();
  gate.note("crankRequest", {
    callbackArrived: crankOk,
    callbacksFromCrank: finalCalls - beforeCrank,
  });

  await closePermission(ctx, session).catch(() => undefined);
  await undelegateProbe(ctx, session);

  if (!controlOk) {
    return gate.finish(
      "error",
      "The wallet-signed VRF control did not complete, so the crank result is not meaningful.",
    );
  }
  if (crankOk) {
    return gate.finish(
      "pass",
      `A crank-scheduled instruction requested VRF and ${finalCalls - beforeCrank} callback(s) arrived. Per-drop VRF becomes a possible enhancement.`,
    );
  }
  return gate.finish(
    "info",
    "A crank-scheduled VRF request produced no callback. Nothing changes: drops stay derived from the one round seed that a signing seat requests.",
  );
}

runIfMain(import.meta.url, run);
