/**
 * A small client for the MagicBlock Private Payments HTTP API (gate G5): sign in, read private
 * balances, deposit into the rollup, move tokens privately inside it and withdraw. Every call that
 * changes something builds a transaction on the API, signs it here with the listed keys and sends it.
 */
import { Connection, type Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const API = "https://payments.magicblock.app";
const CLUSTER = "devnet-private";

type Built = {
  transactionBase64: string;
  sendTo: "base" | "ephemeral";
  sendRpcEndpoint?: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  requiredSigners: string[];
};

export class PaymentsError extends Error {}

async function call(
  method: "GET" | "POST",
  path: string,
  payload?: object,
  token?: string,
): Promise<Record<string, unknown>> {
  const url =
    method === "GET" && payload
      ? `${API}${path}?${new URLSearchParams(payload as Record<string, string>)}`
      : `${API}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!response.ok) {
    throw new PaymentsError(`${path} ${response.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json as Record<string, unknown>;
}

export class Payments {
  private readonly tokens = new Map<string, { token: string; at: number }>();
  private readonly base: Connection;

  constructor(baseRpcUrl: string) {
    this.base = new Connection(baseRpcUrl, "confirmed");
  }

  /** Signs in with a keypair (the API checks a signed challenge) and caches the token for ten minutes. */
  async login(keypair: Keypair): Promise<string> {
    const key = keypair.publicKey.toBase58();
    const cached = this.tokens.get(key);
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.token;
    const { challenge } = (await call("GET", "/v1/spl/challenge", {
      pubkey: key,
      cluster: CLUSTER,
    })) as { challenge: string };
    const signature = nacl.sign.detached(Buffer.from(challenge), keypair.secretKey);
    let failure: unknown;
    for (const encoded of [bs58.encode(signature), Buffer.from(signature).toString("base64")]) {
      try {
        const result = (await call("POST", "/v1/spl/login", {
          pubkey: key,
          challenge,
          signature: encoded,
          cluster: CLUSTER,
        })) as { token: string };
        this.tokens.set(key, { token: result.token, at: Date.now() });
        return result.token;
      } catch (error) {
        failure = error;
      }
    }
    throw new PaymentsError(`login failed: ${String(failure)}`);
  }

  /** A private balance in token base units, read with the owner's own token. */
  async privateBalance(owner: Keypair, mint: PublicKey): Promise<bigint> {
    const token = await this.login(owner);
    const result = (await call(
      "GET",
      "/v1/spl/private-balance",
      { address: owner.publicKey.toBase58(), mint: mint.toBase58(), cluster: CLUSTER },
      token,
    )) as { balance: string };
    return BigInt(result.balance);
  }

  /** Base layer to the rollup: the owner signs and pays. */
  async deposit(owner: Keypair, mint: PublicKey, amount: bigint): Promise<string> {
    const built = (await call("POST", "/v1/spl/deposit", {
      owner: owner.publicKey.toBase58(),
      amount: Number(amount),
      mint: mint.toBase58(),
      cluster: CLUSTER,
      initIfMissing: true,
      initVaultIfMissing: true,
      initAtasIfMissing: true,
      private: true,
    })) as unknown as Built;
    return this.submit(built, [owner]);
  }

  /** A private transfer inside the rollup (a buy-in or a prize), signed in with the sender's token. */
  async transfer(from: Keypair, to: PublicKey, mint: PublicKey, amount: bigint): Promise<string> {
    const token = await this.login(from);
    const built = (await call(
      "POST",
      "/v1/spl/transfer",
      {
        from: from.publicKey.toBase58(),
        to: to.toBase58(),
        mint: mint.toBase58(),
        amount: Number(amount),
        visibility: "private",
        fromBalance: "ephemeral",
        toBalance: "ephemeral",
        cluster: CLUSTER,
        initIfMissing: true,
        initAtasIfMissing: true,
      },
      token,
    )) as unknown as Built;
    return this.submit(built, [from], token);
  }

  /** Rollup back to the base layer. */
  async withdraw(owner: Keypair, mint: PublicKey, amount: bigint): Promise<string> {
    const token = await this.login(owner);
    const built = (await call(
      "POST",
      "/v1/spl/withdraw",
      {
        owner: owner.publicKey.toBase58(),
        mint: mint.toBase58(),
        amount: Number(amount),
        cluster: CLUSTER,
        idempotent: true,
        initAtasIfMissing: true,
      },
      token,
    )) as unknown as Built;
    return this.submit(built, [owner], token);
  }

  private async submit(built: Built, signers: Keypair[], token?: string): Promise<string> {
    const tx = VersionedTransaction.deserialize(Buffer.from(built.transactionBase64, "base64"));
    const wanted = new Set(built.requiredSigners);
    tx.sign(signers.filter((signer) => wanted.has(signer.publicKey.toBase58())));
    if (built.sendTo === "base") {
      // straight to the devnet RPC: the hosted API reported false expiries when it confirmed
      const signature = await this.base.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
      const confirmation = await this.base.confirmTransaction(
        {
          signature,
          blockhash: built.recentBlockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new PaymentsError(
          `base transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }
      return signature;
    }
    const result = await call(
      "POST",
      "/v1/transaction/send",
      {
        transactionBase64: Buffer.from(tx.serialize()).toString("base64"),
        sendTo: built.sendTo,
        ...(built.sendRpcEndpoint ? { sendRpcEndpoint: built.sendRpcEndpoint } : {}),
        cluster: CLUSTER,
      },
      token,
    );
    return String(result.signature);
  }
}
