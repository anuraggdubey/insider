/** Loads or creates one keypair file per roster member. Key files never leave `.keys/`. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Keypair } from "@solana/web3.js";

import { type Member } from "./roster.js";

export const keyPath = (dir: string, member: Member) => resolve(dir, `${member.id}.json`);

export function loadKeypair(path: string): Keypair | undefined {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  } catch {
    return undefined;
  }
}

/** Returns the member's keypair, generating and saving one on first use. */
export function loadOrCreate(dir: string, member: Member): { keypair: Keypair; created: boolean } {
  const path = keyPath(dir, member);
  const existing = loadKeypair(path);
  if (existing) return { keypair: existing, created: false };
  const keypair = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
  return { keypair, created: true };
}

export function loadAll(dir: string, members: readonly Member[]) {
  return members.map((member) => ({ member, ...loadOrCreate(dir, member) }));
}
