import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import idl from "../../../idl/insider.json" with { type: "json" };
import { ROOT, config } from "./config.js";
import { addressUrl, baseTxUrl, erTxUrl } from "./explorer.js";

export type Step = {
  step: string;
  layer: "base" | "ER" | "TEE";
  signature: string;
  url: string;
  ms?: number;
};

/** Collects every transaction of an experiment so it can be written out as proof. */
export class Run {
  readonly steps: Step[] = [];
  readonly facts: Record<string, unknown> = {};

  constructor(readonly name: string) {}

  note(key: string, value: unknown) {
    this.facts[key] = value;
    console.log(`${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  }

  writeProof() {
    const dir = resolve(ROOT, "docs/proofs");
    mkdirSync(dir, { recursive: true });
    const proof = {
      experiment: this.name,
      network: "devnet",
      program: { id: config.programId.toBase58(), url: addressUrl(config.programId.toBase58()) },
      facts: this.facts,
      steps: this.steps,
    };
    writeFileSync(resolve(dir, `${this.name}.json`), JSON.stringify(proof, null, 2) + "\n");
    console.log(`wrote docs/proofs/${this.name}.json`);
  }
}

export const program = (connection: Connection, payer: Keypair) =>
  new Program(idl as Idl, new AnchorProvider(connection, new Wallet(payer), {}));

export const labPda = (authority: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("lab"), authority.toBuffer()], config.programId)[0];

export const slotPda = (authority: PublicKey, index: number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("slot"), authority.toBuffer(), Buffer.from([index])],
    config.programId,
  )[0];

type SendOptions = {
  run: Run;
  step: string;
  layer: Step["layer"];
  /** Endpoint used for the explorer link of ER and TEE transactions. */
  erUrl?: string;
  /** Extra signers besides the payer. */
  signers?: Keypair[];
};

/** Signs, sends and confirms a transaction on any connection, recording it in the run. */
export async function send(
  connection: Connection,
  payer: Keypair,
  tx: Transaction,
  { run, step, layer, erUrl, signers = [] }: SendOptions,
): Promise<string> {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const started = performance.now();
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, ...signers], {
    commitment: "confirmed",
  });
  const ms = Math.round(performance.now() - started);
  const url = layer === "base" || !erUrl ? baseTxUrl(signature) : erTxUrl(signature, erUrl);
  run.steps.push({ step, layer, signature, url, ms });
  console.log(`${layer.padEnd(4)} ${step.padEnd(28)} ${String(ms).padStart(5)}ms  ${signature}`);
  return signature;
}
