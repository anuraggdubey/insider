import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Keypair, PublicKey } from "@solana/web3.js";
import { config as loadEnv } from "dotenv";
import { createConfig, VALIDATORS } from "#config";

export * from "#index";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(ROOT, ".env"), quiet: true });

export const config = {
  ...createConfig({
    baseRpcUrl: process.env.SOLANA_RPC_URL || undefined,
    routerUrl: process.env.MAGIC_ROUTER_URL || undefined,
    routerWsUrl: process.env.MAGIC_ROUTER_WS_URL || undefined,
    teeRpcUrl: process.env.TEE_RPC_URL || undefined,
    programId: process.env.INSIDER_PROGRAM_ID
      ? new PublicKey(process.env.INSIDER_PROGRAM_ID)
      : undefined,
    teeValidator: process.env.TEE_VALIDATOR ? new PublicKey(process.env.TEE_VALIDATOR) : undefined,
  }),
  erValidator: process.env.ER_VALIDATOR ? new PublicKey(process.env.ER_VALIDATOR) : VALIDATORS.er,
  walletPath: resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"),
};

export function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export type ValidatorKind = keyof typeof VALIDATORS;
export function parseValidatorArg(argv: string[]): ValidatorKind {
  const index = argv.indexOf("--validator");
  const value = index >= 0 ? argv[index + 1] : "er";
  if (value !== "er" && value !== "tee") throw new Error("--validator must be er or tee");
  return value;
}

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
