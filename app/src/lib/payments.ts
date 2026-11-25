import { type Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { WalletSigner } from "./floor-store";

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

export class PaymentNotSubmittedError extends PaymentsError {}

export class BrowserPayments {
  private token: { value: string; at: number } | null = null;

  constructor(
    private readonly base: Connection,
    private readonly wallet: WalletSigner,
  ) {}

  private async call(
    method: "GET" | "POST",
    path: string,
    payload: Record<string, unknown>,
    token?: string,
  ) {
    const query =
      method === "GET" ? `?${new URLSearchParams(payload as Record<string, string>)}` : "";
    const response = await fetch(`${API}${path}${query}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: method === "POST" ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new PaymentsError(
        `${path} returned ${response.status}: ${JSON.stringify(data).slice(0, 300)}`,
      );
    return data as Record<string, unknown>;
  }

  async login() {
    if (this.token && Date.now() - this.token.at < 10 * 60_000) return this.token.value;
    const pubkey = this.wallet.publicKey.toBase58();
    const { challenge } = await this.call("GET", "/v1/spl/challenge", { pubkey, cluster: CLUSTER });
    if (typeof challenge !== "string")
      throw new PaymentsError("Payments returned an invalid challenge.");
    const signature = await this.wallet.signMessage(new TextEncoder().encode(challenge));
    let failure: unknown;
    for (const encoded of [bs58.encode(signature), Buffer.from(signature).toString("base64")]) {
      try {
        const result = await this.call("POST", "/v1/spl/login", {
          pubkey,
          challenge,
          signature: encoded,
          cluster: CLUSTER,
        });
        if (typeof result.token !== "string")
          throw new PaymentsError("Payments returned no token.");
        this.token = { value: result.token, at: Date.now() };
        return result.token;
      } catch (error) {
        failure = error;
      }
    }
    throw new PaymentsError(`Payments login failed: ${String(failure)}`);
  }

  async privateBalance(mint: PublicKey) {
    const token = await this.login();
    const result = await this.call(
      "GET",
      "/v1/spl/private-balance",
      {
        address: this.wallet.publicKey.toBase58(),
        mint: mint.toBase58(),
        cluster: CLUSTER,
      },
      token,
    );
    return BigInt(String(result.balance));
  }

  async deposit(mint: PublicKey, amount: bigint) {
    const built = await this.build("/v1/spl/deposit", {
      owner: this.wallet.publicKey.toBase58(),
      amount: safeAmount(amount),
      mint: mint.toBase58(),
      cluster: CLUSTER,
      initIfMissing: true,
      initVaultIfMissing: true,
      initAtasIfMissing: true,
      private: true,
    });
    return this.submit(built as unknown as Built);
  }

  async transfer(to: PublicKey, mint: PublicKey, amount: bigint) {
    let token: string;
    try {
      token = await this.login();
    } catch (cause) {
      throw new PaymentNotSubmittedError(
        cause instanceof Error ? cause.message : "Could not sign in to Payments.",
      );
    }
    const built = await this.build(
      "/v1/spl/transfer",
      {
        from: this.wallet.publicKey.toBase58(),
        to: to.toBase58(),
        mint: mint.toBase58(),
        amount: safeAmount(amount),
        visibility: "private",
        fromBalance: "ephemeral",
        toBalance: "ephemeral",
        cluster: CLUSTER,
        initIfMissing: true,
        initAtasIfMissing: true,
      },
      token,
    );
    return this.submit(built as unknown as Built, token);
  }

  private async build(path: string, payload: Record<string, unknown>, token?: string) {
    try {
      return await this.call("POST", path, payload, token);
    } catch (cause) {
      throw new PaymentNotSubmittedError(
        cause instanceof Error ? cause.message : "Could not build the transaction.",
      );
    }
  }

  private async submit(built: Built, token?: string) {
    let serialized: Uint8Array;
    try {
      if (!this.wallet.signVersionedTransaction)
        throw new Error("Your wallet cannot sign versioned transactions.");
      if (!built.requiredSigners?.includes(this.wallet.publicKey.toBase58()))
        throw new Error("Payments did not request your signature.");
      if (built.sendTo !== "base" && built.sendTo !== "ephemeral")
        throw new Error("Payments returned an invalid transaction destination.");
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(built.transactionBase64, "base64"),
      );
      const signed = await this.wallet.signVersionedTransaction(transaction);
      serialized = signed.serialize();
    } catch (cause) {
      throw new PaymentNotSubmittedError(
        cause instanceof Error ? cause.message : "Could not sign the transaction.",
      );
    }
    if (built.sendTo === "base") {
      const signature = await this.base.sendRawTransaction(serialized, { maxRetries: 5 });
      const result = await this.base.confirmTransaction(
        {
          signature,
          blockhash: built.recentBlockhash,
          lastValidBlockHeight: built.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (result.value.err)
        throw new PaymentsError(`Base transaction failed: ${JSON.stringify(result.value.err)}`);
      return signature;
    }
    const result = await this.call(
      "POST",
      "/v1/transaction/send",
      {
        transactionBase64: Buffer.from(serialized).toString("base64"),
        sendTo: built.sendTo,
        ...(built.sendRpcEndpoint ? { sendRpcEndpoint: built.sendRpcEndpoint } : {}),
        cluster: CLUSTER,
      },
      token,
    );
    if (typeof result.signature !== "string")
      throw new PaymentsError("Payments returned no signature.");
    return result.signature;
  }
}

function safeAmount(amount: bigint) {
  const value = Number(amount);
  if (amount <= BigInt(0) || !Number.isSafeInteger(value))
    throw new PaymentsError("Invalid token amount.");
  return value;
}
