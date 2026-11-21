import { readFileSync } from "node:fs";
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
    process.env.INSIDER_PROGRAM_ID || "5TbtvduZEmNWbnr7wfvB9A9TobbxSB96e1xYcr6NnSDQ",
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
