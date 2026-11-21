import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import type { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

/** Signs the TEE login challenge and returns an RPC URL that carries the auth token. */
export async function teeAuthUrl(rpcUrl: string, keypair: Keypair) {
  const base = rpcUrl.replace(/\/$/, "");
  const { token, expiresAt } = await getAuthToken(base, keypair.publicKey, async (message) =>
    nacl.sign.detached(message, keypair.secretKey),
  );
  return { token, expiresAt, url: `${base}?token=${token}` };
}
