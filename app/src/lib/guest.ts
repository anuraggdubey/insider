import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const KEY = "insider.guest.v1";

export function loadGuest(): Keypair | null {
  const encoded = localStorage.getItem(KEY);
  if (!encoded) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(encoded));
  } catch {
    throw new Error("The saved guest key is invalid. Import a valid key to continue.");
  }
}

export function createGuest(): Keypair {
  const existing = loadGuest();
  if (existing) return existing;
  const guest = Keypair.generate();
  localStorage.setItem(KEY, bs58.encode(guest.secretKey));
  return guest;
}

export function importGuest(json: string): Keypair {
  const parsed: unknown = JSON.parse(json);
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    !parsed.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  )
    throw new Error("Expected a JSON array containing a 64-byte secret key.");
  const guest = Keypair.fromSecretKey(Uint8Array.from(parsed));
  localStorage.setItem(KEY, bs58.encode(guest.secretKey));
  return guest;
}

export function exportGuest(guest: Keypair): string {
  return JSON.stringify(Array.from(guest.secretKey));
}
