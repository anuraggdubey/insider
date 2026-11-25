"use client";

import { BN } from "@anchor-lang/core";
import { baseConnection } from "@insider/sdk/connection";
import { createConfig, type InsiderConfig } from "@insider/sdk/config";
import { sessionTokenPda } from "@insider/sdk";
import { Keypair, PublicKey, type Connection, type Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { FastSession, WalletSigner } from "./floor-store";

const LIFETIME_SECONDS = 24 * 60 * 60;
const EXPIRY_MARGIN_MS = 60_000;
const prefix = "insider.session.";

type StoredSession = {
  wallet: string;
  secret: string;
  token: string;
  validUntil: number;
  pending?: boolean;
};

export const sessionStorageKey = (wallet: PublicKey) => `${prefix}${wallet.toBase58()}`;

export function sessionConfig() {
  return createConfig({
    baseRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || undefined,
    programId: process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID
      ? new PublicKey(process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID)
      : undefined,
  });
}

export function saveSession(
  session: FastSession,
  storage: Storage = localStorage,
  pending = false,
) {
  const record: StoredSession = {
    wallet: session.wallet.toBase58(),
    secret: bs58.encode(session.signer.secretKey),
    token: session.token.toBase58(),
    validUntil: session.validUntil,
    ...(pending ? { pending: true } : {}),
  };
  storage.setItem(sessionStorageKey(session.wallet), JSON.stringify(record));
}

export function clearSession(wallet: PublicKey, storage: Storage = localStorage) {
  storage.removeItem(sessionStorageKey(wallet));
}

export async function restoreSession(
  config: InsiderConfig,
  wallet: WalletSigner,
  connection: Connection = baseConnection(config),
  storage: Storage = localStorage,
  now = Date.now(),
): Promise<FastSession | null> {
  const raw = storage.getItem(sessionStorageKey(wallet.publicKey));
  if (!raw) return null;
  let session: FastSession;
  let pending = false;
  try {
    const record = JSON.parse(raw) as StoredSession;
    if (record.wallet !== wallet.publicKey.toBase58() || !Number.isSafeInteger(record.validUntil))
      throw new Error("Invalid session.");
    const signer = Keypair.fromSecretKey(bs58.decode(record.secret));
    const token = new PublicKey(record.token);
    if (!token.equals(sessionTokenPda(wallet.publicKey, signer.publicKey, config.programId)))
      throw new Error("Invalid session token.");
    session = { wallet: wallet.publicKey, signer, token, validUntil: record.validUntil };
    pending = record.pending === true;
  } catch {
    clearSession(wallet.publicKey, storage);
    return null;
  }
  if (session.validUntil * 1000 <= now + EXPIRY_MARGIN_MS) {
    clearSession(wallet.publicKey, storage);
    return null;
  }
  if (!(await connection.getAccountInfo(session.token, "confirmed"))) {
    if (pending)
      throw new Error(
        "Session creation outcome is unknown. Check the wallet transaction before trying again.",
      );
    clearSession(wallet.publicKey, storage);
    return null;
  }
  if (pending) saveSession(session, storage);
  return session;
}

async function manager(wallet: WalletSigner, connection: Connection) {
  const { SessionTokenManager } = await import("@magicblock-labs/gum-sdk");
  return new SessionTokenManager(
    {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: async (transactions: Transaction[]) => {
        const signed: Transaction[] = [];
        for (const transaction of transactions)
          signed.push(await wallet.signTransaction(transaction));
        return signed;
      },
    } as never,
    connection as never,
  );
}

async function sendBase(
  connection: Connection,
  wallet: WalletSigner,
  transaction: Transaction,
  sessionSigner?: Keypair,
  beforeSend?: () => void,
) {
  const blockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = blockhash.blockhash;
  if (sessionSigner) transaction.partialSign(sessionSigner);
  const signed = await wallet.signTransaction(transaction);
  beforeSend?.();
  const signature = await connection.sendRawTransaction(signed.serialize());
  const result = await connection.confirmTransaction({ signature, ...blockhash }, "confirmed");
  if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  return signature;
}

export async function enableSession(
  config: InsiderConfig,
  wallet: WalletSigner,
  connection: Connection = baseConnection(config),
  storage: Storage = localStorage,
) {
  if (storage.getItem(sessionStorageKey(wallet.publicKey))) {
    const existing = await restoreSession(config, wallet, connection, storage);
    if (existing) return { session: existing, signature: "" };
  }
  const signer = Keypair.generate();
  const validUntil = Math.floor(Date.now() / 1000) + LIFETIME_SECONDS;
  const token = sessionTokenPda(wallet.publicKey, signer.publicKey, config.programId);
  const gum = await manager(wallet, connection);
  const transaction = (await gum.program.methods
    .createSessionV2(false, new BN(validUntil), null)
    .accounts({
      targetProgram: config.programId,
      sessionSigner: signer.publicKey,
      feePayer: wallet.publicKey,
      authority: wallet.publicKey,
    })
    .transaction()) as Transaction;
  const probe = `${sessionStorageKey(wallet.publicKey)}.probe`;
  storage.setItem(probe, "1");
  storage.removeItem(probe);
  const session = { wallet: wallet.publicKey, signer, token, validUntil };
  let signature: string;
  try {
    signature = await sendBase(connection, wallet, transaction, signer, () =>
      saveSession(session, storage, true),
    );
  } catch (error) {
    if (/insufficient (funds|lamports)|insufficient balance|prior credit/i.test(String(error)))
      clearSession(wallet.publicKey, storage);
    throw error;
  }
  if (!(await connection.getAccountInfo(token, "confirmed")))
    throw new Error("Session transaction confirmed, but its token account is not visible yet.");
  saveSession(session, storage);
  return { session, signature };
}

export async function disableSession(
  config: InsiderConfig,
  wallet: WalletSigner,
  session: FastSession,
  connection: Connection = baseConnection(config),
  storage: Storage = localStorage,
) {
  if (!session.wallet.equals(wallet.publicKey)) throw new Error("Reconnect the session wallet.");
  if (session.validUntil * 1000 > Date.now()) {
    const gum = await manager(wallet, connection);
    const transaction = (await gum.program.methods
      .revokeSessionV2()
      .accounts({
        sessionToken: session.token,
        feePayer: wallet.publicKey,
        authority: wallet.publicKey,
      })
      .transaction()) as Transaction;
    await sendBase(connection, wallet, transaction);
  }
  clearSession(wallet.publicKey, storage);
}
