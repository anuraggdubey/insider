import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Keypair, PublicKey } from "@solana/web3.js";
import { config as loadEnv } from "dotenv";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(ROOT, ".env"), quiet: true });

export const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");

export const config = {
  baseRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  routerUrl: process.env.MAGIC_ROUTER_URL || "https://devnet-router.magicblock.app",
  programId: new PublicKey(
    process.env.INSIDER_PROGRAM_ID || "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW",
  ),
  erValidator: new PublicKey(
    process.env.ER_VALIDATOR || "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
  ),
  walletPath: resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"),
};

export function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export const VALIDATORS = {
  er: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"),
  tee: new PublicKey("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"),
} as const;
export type ValidatorKind = keyof typeof VALIDATORS;

export function parseValidatorArg(argv: string[]): ValidatorKind {
  const index = argv.indexOf("--validator");
  const value = index >= 0 ? argv[index + 1] : "er";
  if (value !== "er" && value !== "tee") throw new Error(`--validator must be er or tee`);
  return value;
}

/** Loads a keypair file, creating and saving a fresh one when it does not exist yet. */
export function loadOrCreateKeypair(path: string): Keypair {
  try {
    return loadKeypair(path);
  } catch {
    const keypair = Keypair.generate();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
    return keypair;
  }
}
