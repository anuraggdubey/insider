import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Keypair, type PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export type MessageSigner =
  | Keypair
  | {
      publicKey: PublicKey;
      signMessage(message: Uint8Array): Promise<Uint8Array>;
    };
type Auth = { token: string; expiresAt: number; url: string };
const cache = new Map<string, Auth>();

export async function teeAuthUrl(rpcUrl: string, signer: MessageSigner): Promise<Auth> {
  const base = rpcUrl.replace(/\/$/, "");
  const key = `${base}:${signer.publicKey.toBase58()}`;
  const previous = cache.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous;
  cache.delete(key);
  const sign =
    signer instanceof Keypair
      ? async (message: Uint8Array) => nacl.sign.detached(message, signer.secretKey)
      : (message: Uint8Array) => signer.signMessage(message);
  const { token, expiresAt } = await getAuthToken(base, signer.publicKey, sign);
  const url = new URL(base);
  url.searchParams.set("token", token);
  const result = { token, expiresAt, url: url.toString() };
  if (expiresAt > Date.now()) {
    if (cache.size >= 128) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, result);
  }
  return result;
}
