/** Service configuration: the SDK devnet config plus where the keys and the table live. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Keypair, PublicKey } from "@solana/web3.js";

import { ROOT, config as sdkConfig, type InsiderConfig } from "@insider/sdk/node";

export type BotConfig = {
  insider: InsiderConfig;
  agentDir: string;
  /** Milliseconds between decisions (two ticks). */
  decisionMs: number;
};

/** The table authority: `TABLE_AUTHORITY`, else the deployer key the setup script used. */
export function tableAuthority(): PublicKey {
  const fromEnv = process.env.TABLE_AUTHORITY;
  if (fromEnv) return new PublicKey(fromEnv);
  const wallet = resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json");
  const secret = JSON.parse(readFileSync(wallet, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey;
}

export function loadConfig(): BotConfig {
  return {
    insider: { ...sdkConfig, tableAuthority: tableAuthority() },
    agentDir: resolve(ROOT, process.env.AGENT_KEYPAIR_DIR || ".keys/agents"),
    decisionMs: Number(process.env.BOT_DECISION_MS || 1_000),
  };
}
