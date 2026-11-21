/**
 * Phase 1 spike: prove the base layer -> Ephemeral Rollup -> base layer round trip on devnet.
 *   init (base) -> delegate (base) -> increment xN (ER) -> commit (ER) -> undelegate (ER)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

import idl from "../../idl/insider.json" with { type: "json" };
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  ROOT,
  config,
  loadKeypair,
} from "./lib/config.js";
import { addressUrl, baseTxUrl, erTxUrl } from "./lib/explorer.js";
import { getDelegationStatus, waitFor } from "./lib/rpc.js";

const INCREMENTS = 5;

type Step = { step: string; layer: "base" | "ER"; signature: string; url: string; ms?: number };
const steps: Step[] = [];

async function main() {
  const payer = loadKeypair(config.walletPath);
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const baseProgram = new Program(idl as Idl, new AnchorProvider(base, new Wallet(payer), {}));
  const [spike] = PublicKey.findProgramAddressSync(
    [Buffer.from("spike"), payer.publicKey.toBuffer()],
    config.programId,
  );

  console.log(`wallet  ${payer.publicKey.toBase58()}`);
  console.log(`program ${config.programId.toBase58()}`);
  console.log(`spike   ${spike.toBase58()}`);

  const baseSend = async (step: string, tx: Transaction) => {
    const started = performance.now();
    const signature = await sendAndConfirmTransaction(base, tx, [payer], {
      commitment: "confirmed",
    });
    const ms = Math.round(performance.now() - started);
    steps.push({ step, layer: "base", signature, url: baseTxUrl(signature), ms });
    console.log(`base ${step.padEnd(18)} ${ms}ms  ${signature}`);
    return signature;
  };

  // 1. initialise on the base layer if this wallet has no spike yet
  const existing = await base.getAccountInfo(spike);
  if (!existing) {
    await baseSend("spike_init", await baseProgram.methods.spikeInit().transaction());
  } else if (existing.owner.equals(DELEGATION_PROGRAM_ID)) {
    console.log("spike is still delegated from an earlier run; resuming on the ER");
  }

  // 2. delegate to the ER validator
  const current = await base.getAccountInfo(spike);
  if (current && !current.owner.equals(DELEGATION_PROGRAM_ID)) {
    const tx = await baseProgram.methods
      .spikeDelegate()
      .accounts({ payer: payer.publicKey, spike })
      .remainingAccounts([{ pubkey: config.erValidator, isSigner: false, isWritable: false }])
      .transaction();
    await baseSend("spike_delegate", tx);
  }

  // 3. discover the ER endpoint that now serves the account
  const status = await waitFor("router delegation status", async () => {
    const s = await getDelegationStatus(config.routerUrl, spike);
    return s.isDelegated && s.fqdn ? s : undefined;
  });
  const erUrl = status.fqdn!.replace(/\/$/, "");
  console.log(`ER endpoint ${erUrl}`);
  const er = new Connection(erUrl, "confirmed");
  const erProgram = new Program(idl as Idl, new AnchorProvider(er, new Wallet(payer), {}));

  const erSend = async (step: string, build: () => Promise<Transaction>) => {
    const tx = await build();
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await er.getLatestBlockhash()).blockhash;
    const started = performance.now();
    const signature = await sendAndConfirmTransaction(er, tx, [payer], { commitment: "confirmed" });
    const ms = Math.round(performance.now() - started);
    steps.push({ step, layer: "ER", signature, url: erTxUrl(signature, erUrl), ms });
    console.log(`ER   ${step.padEnd(18)} ${ms}ms  ${signature}`);
    return signature;
  };

  // 4. real-time increments on the ER
  for (let i = 1; i <= INCREMENTS; i++) {
    await erSend(`spike_increment #${i}`, () =>
      erProgram.methods
        .spikeIncrement()
        .accounts({ authority: payer.publicKey, spike })
        .transaction(),
    );
  }
  const onErInfo = await er.getAccountInfo(spike);
  if (!onErInfo) throw new Error("spike account not found on the ER");
  const onEr = erProgram.coder.accounts.decode("spike", onErInfo.data);
  console.log(`count on ER: ${onEr.count}`);

  // 5. commit while staying delegated, then commit and undelegate
  await erSend("spike_commit", () =>
    erProgram.methods.spikeCommit().accounts({ payer: payer.publicKey, spike }).transaction(),
  );
  const undelegateSig = await erSend("spike_undelegate", () =>
    erProgram.methods
      .spikeUndelegate()
      .accounts({
        payer: payer.publicKey,
        spike,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .transaction(),
  );

  // 6. the base-layer settlement transaction and the final state
  const commitSig = await GetCommitmentSignature(undelegateSig, er);
  await base.confirmTransaction(commitSig, "confirmed");
  steps.push({
    step: "base settlement (commit+undelegate)",
    layer: "base",
    signature: commitSig,
    url: baseTxUrl(commitSig),
  });
  console.log(`base settlement                    ${commitSig}`);

  const returned = await waitFor("undelegation on base", async () => {
    const info = await base.getAccountInfo(spike);
    return info && info.owner.equals(config.programId) ? info : undefined;
  });
  const finalState = baseProgram.coder.accounts.decode("spike", returned.data);
  console.log(`count on base after undelegation: ${finalState.count}`);

  const proofDir = resolve(ROOT, "docs/proofs");
  mkdirSync(proofDir, { recursive: true });
  writeFileSync(
    resolve(proofDir, "er-spike.json"),
    JSON.stringify(
      {
        network: "devnet",
        program: { id: config.programId.toBase58(), url: addressUrl(config.programId.toBase58()) },
        spike: { pda: spike.toBase58(), url: addressUrl(spike.toBase58()) },
        erValidator: config.erValidator.toBase58(),
        erEndpoint: erUrl,
        finalCount: Number(finalState.count),
        steps,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("wrote docs/proofs/er-spike.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
