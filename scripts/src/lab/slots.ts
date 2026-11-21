/**
 * Spike E: how many accounts can one round delegate, update and settle together?
 * The game needs about 11 (round, market, tape and 8 players), so this uses 11 slot accounts.
 * Usage: pnpm lab:slots [--validator er|tee] [--count 11] [--offset 0] [--settle-batch 11] [--settle-timeout 120]
 */
import {
  ComputeBudgetProgram,
  Transaction,
  type Connection,
  type PublicKey,
} from "@solana/web3.js";

import { Run, send, slotPda } from "../lib/client.js";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  VALIDATORS,
  config,
  parseValidatorArg,
} from "../lib/config.js";
import { connectEndpoint, labContext, type Session } from "../lib/lab.js";
import { getDelegationStatus, waitFor } from "../lib/rpc.js";

const TX_LIMIT_BYTES = 1232;

function numberArg(argv: string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  return index >= 0 ? Number(argv[index + 1]) : fallback;
}

async function computeUnits(connection: Connection, signature: string) {
  try {
    const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
    return tx?.meta?.computeUnitsConsumed ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const kind = parseValidatorArg(process.argv);
  const count = numberArg(process.argv, "--count", 11);
  const offset = numberArg(process.argv, "--offset", 0);
  const settleBatch = numberArg(process.argv, "--settle-batch", count);
  const settleTimeoutMs = numberArg(process.argv, "--settle-timeout", 120) * 1000;
  const run = new Run(`lab-slots-${kind}-${count}${offset ? `-at${offset}` : ""}`);
  const ctx = labContext(run);
  const { payer, base, baseProgram } = ctx;
  const layer = kind === "tee" ? "TEE" : "ER";
  const indexes = Array.from({ length: count }, (_, i) => offset + i);
  const slots: PublicKey[] = indexes.map((index) => slotPda(payer.publicKey, index));
  run.note("slots", count);
  run.note("validator", `${kind} ${VALIDATORS[kind].toBase58()}`);

  const ownerOf = async (slot: PublicKey) => (await base.getAccountInfo(slot))?.owner;
  const writableMetas = (keys: PublicKey[]) =>
    keys.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }));

  // 0. settle anything a previous run left delegated, so every run starts from the base layer
  const stale: PublicKey[] = [];
  for (const slot of slots) {
    const owner = await ownerOf(slot);
    if (owner?.equals(DELEGATION_PROGRAM_ID)) stale.push(slot);
  }
  if (stale.length > 0) {
    const status = await getDelegationStatus(config.routerUrl, stale[0]!);
    const old: Session = await connectEndpoint(ctx, status.fqdn!);
    console.log(`${stale.length} slots still delegated to ${status.fqdn}; settling them first`);
    await send(
      old.er,
      payer,
      await old.erProgram.methods
        .slotSettleAll()
        .accounts({
          payer: payer.publicKey,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        })
        .remainingAccounts(writableMetas(stale))
        .transaction(),
      { run, step: "slot_settle_all (cleanup)", layer: old.layer, erUrl: old.endpoint },
    );
    await waitFor("cleanup undelegation", async () => {
      for (const slot of stale)
        if (!(await ownerOf(slot))?.equals(config.programId)) return undefined;
      return true;
    });
  }

  // 1. create the missing slots, four per transaction
  const missing: number[] = [];
  for (let i = 0; i < count; i++) if (!(await base.getAccountInfo(slots[i]!))) missing.push(i);
  for (let from = 0; from < missing.length; from += 4) {
    const tx = new Transaction();
    for (const i of missing.slice(from, from + 4)) {
      tx.add(
        await baseProgram.methods
          .slotInit(indexes[i]!)
          .accounts({ authority: payer.publicKey, slot: slots[i]! })
          .instruction(),
      );
    }
    await send(base, payer, tx, {
      run,
      step: `slot_init x${tx.instructions.length}`,
      layer: "base",
    });
  }

  // 2. find how many delegate instructions fit in one transaction
  const delegateIx = (i: number) =>
    baseProgram.methods
      .slotDelegate(indexes[i]!)
      .accounts({ payer: payer.publicKey, slot: slots[i]! })
      .remainingAccounts([{ pubkey: VALIDATORS[kind], isSigner: false, isWritable: false }])
      .instruction();
  const instructions = await Promise.all(slots.map((_, i) => delegateIx(i)));
  const blockhash = (await base.getLatestBlockhash()).blockhash;
  const fits = (k: number) => {
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ...instructions.slice(0, k),
    );
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = blockhash;
    try {
      return (
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length <=
        TX_LIMIT_BYTES
      );
    } catch {
      return false;
    }
  };
  let perTx = 1;
  for (let k = count; k >= 1; k--) {
    if (fits(k)) {
      perTx = k;
      break;
    }
  }
  run.note("delegatesPerTransaction", { maxThatFit: perTx, txLimitBytes: TX_LIMIT_BYTES });

  // 3. delegate everything in the fewest transactions
  for (let from = 0; from < count; from += perTx) {
    const chunk = instructions.slice(from, from + perTx);
    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ...chunk,
    );
    const signature = await send(base, payer, tx, {
      run,
      step: `slot_delegate x${chunk.length}`,
      layer: "base",
    });
    run.note(`delegateComputeUnits x${chunk.length}`, await computeUnits(base, signature));
  }

  const status = await waitFor("all slots delegated", async () => {
    let first: Awaited<ReturnType<typeof getDelegationStatus>> | undefined;
    for (const slot of slots) {
      const s = await getDelegationStatus(config.routerUrl, slot);
      if (!s.isDelegated || !s.fqdn) return undefined;
      first ??= s;
    }
    return first;
  });
  const session = await connectEndpoint(ctx, status.fqdn!);
  run.note("endpoint", session.endpoint);

  // 4. update all accounts in a single rollup instruction, repeatedly
  const bumpLatencies: number[] = [];
  let bumpUnits: number | null = null;
  for (let round = 1; round <= 5; round++) {
    const started = performance.now();
    const signature = await send(
      session.er,
      payer,
      await session.erProgram.methods
        .slotBumpAll()
        .accounts({ authority: payer.publicKey })
        .remainingAccounts(writableMetas(slots))
        .transaction(),
      { run, step: `slot_bump_all x${count} #${round}`, layer, erUrl: session.endpoint },
    );
    bumpLatencies.push(Math.round(performance.now() - started));
    if (round === 1) bumpUnits = await computeUnits(session.er, signature);
  }
  run.note("bumpAll", { accounts: count, computeUnits: bumpUnits, latenciesMs: bumpLatencies });

  // 5. settle in batches: one commit-and-undelegate intent per batch
  const settleUnits: Array<number | null> = [];
  for (let from = 0; from < count; from += settleBatch) {
    const batch = slots.slice(from, from + settleBatch);
    const signature = await send(
      session.er,
      payer,
      await session.erProgram.methods
        .slotSettleAll()
        .accounts({
          payer: payer.publicKey,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        })
        .remainingAccounts(writableMetas(batch))
        .transaction(),
      { run, step: `slot_settle_all x${batch.length}`, layer, erUrl: session.endpoint },
    );
    settleUnits.push(await computeUnits(session.er, signature));
  }
  run.note("settle", {
    batchSize: settleBatch,
    intents: settleUnits.length,
    computeUnitsPerIntent: settleUnits,
  });

  const started = performance.now();
  await waitFor(
    "all slots back on the base layer",
    async () => {
      for (const slot of slots)
        if (!(await ownerOf(slot))?.equals(config.programId)) return undefined;
      return true;
    },
    { timeoutMs: settleTimeoutMs },
  );
  run.note("allSettledOnBaseAfterMs", Math.round(performance.now() - started));

  const counts: number[] = [];
  for (const slot of slots) {
    const info = await base.getAccountInfo(slot);
    counts.push(baseProgram.coder.accounts.decode("slot", info!.data).count.toNumber());
  }
  run.note("countsOnBase", counts);
  run.note(
    "allCountsEqual5",
    counts.every((c) => c % 5 === 0 && c > 0),
  );
  run.writeProof();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
