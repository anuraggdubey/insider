/**
 * Spike A: VRF inside an Ephemeral Rollup.
 *   reset -> delegate (base) -> request randomness (ER/TEE) -> VRF callback fires -> undelegate
 * Usage: pnpm lab:vrf [--validator er|tee]
 */
import { PublicKey } from "@solana/web3.js";

import { Run, send } from "../lib/client.js";
import { VALIDATORS, config, parseValidatorArg } from "../lib/config.js";
import { delegateLab, labContext, readLab, resetLab, undelegateLab } from "../lib/lab.js";
import { waitFor } from "../lib/rpc.js";

/** Delegated VRF oracle queue used for requests made inside a rollup. */
const EPHEMERAL_QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");

async function main() {
  const kind = parseValidatorArg(process.argv);
  const run = new Run(`lab-vrf-${kind}`);
  const ctx = labContext(run);
  run.note("validator", `${kind} ${VALIDATORS[kind].toBase58()}`);
  run.note("lab", ctx.lab.toBase58());

  await resetLab(ctx);
  const session = await delegateLab(ctx, kind);

  const clientSeed = Math.floor(Math.random() * 255);
  await send(
    session.er,
    ctx.payer,
    await session.erProgram.methods
      .labRequestRoll(clientSeed)
      .accounts({ payer: ctx.payer.publicKey, lab: ctx.lab, oracleQueue: EPHEMERAL_QUEUE })
      .transaction(),
    { run, step: "lab_request_roll", layer: session.layer, erUrl: session.endpoint },
  );

  const started = performance.now();
  const rolled = await waitFor(
    "VRF callback",
    async () => {
      const state = await readLab(session.er, session.erProgram, ctx.lab);
      return state && state.rolls.toNumber() > 0 ? state : undefined;
    },
    { timeoutMs: 60_000 },
  ).catch(() => undefined);

  if (!rolled) {
    run.note("vrfCallback", `not delivered within 60s on ${session.endpoint}`);
    const recent = await session.er.getSignaturesForAddress(ctx.lab, { limit: 10 });
    for (const entry of recent) {
      const tx = await session.er.getTransaction(entry.signature, {
        maxSupportedTransactionVersion: 0,
      });
      console.log(
        `  ${entry.signature.slice(0, 12)} err=${JSON.stringify(entry.err)}`,
        tx?.meta?.logMessages?.filter((l) => /Instruction:|Error|failed|consumed/i.test(l)),
      );
    }
    await undelegateLab(ctx, session);
    run.writeProof();
    process.exitCode = 1;
    return;
  }

  run.note("callbackLatencyMs", Math.round(performance.now() - started));
  run.note("randomness", Buffer.from(rolled.randomness).toString("hex"));
  run.note("pickedReader", (rolled.reader as PublicKey).toBase58());
  run.note("pendingAfterCallback", rolled.pending);

  await undelegateLab(ctx, session);
  const onBase = await readLab(ctx.base, ctx.baseProgram, ctx.lab);
  run.note("rollsOnBase", onBase!.rolls.toNumber());
  run.note("readerOnBase", (onBase!.reader as PublicKey).toBase58());
  run.note("matchesProgram", config.programId.toBase58());
  run.writeProof();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
