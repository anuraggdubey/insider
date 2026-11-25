import { readFile } from "node:fs/promises";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export async function installQaWallet(page, keypairPath, rpcUrl = "https://api.devnet.solana.com") {
  if (!keypairPath) throw new Error("Pass the QA keypair file path to installQaWallet.");
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(await readFile(keypairPath, "utf8"))),
  );
  await page.exposeFunction("__insiderQaSignMessage", async (message) =>
    Array.from(nacl.sign.detached(Uint8Array.from(message), keypair.secretKey)),
  );
  await page.exposeFunction("__insiderQaSignTransaction", async (bytes) => {
    const serialized = Buffer.from(bytes);
    try {
      const transaction = VersionedTransaction.deserialize(serialized);
      if (transaction.version === "legacy") throw new Error("legacy transaction");
      transaction.sign([keypair]);
      return Array.from(transaction.serialize());
    } catch {
      const transaction = Transaction.from(serialized);
      transaction.partialSign(keypair);
      return Array.from(transaction.serialize({ requireAllSignatures: false }));
    }
  });
  await page.exposeFunction("__insiderQaDecodeSignature", (value) =>
    Array.from(bs58.decode(value)),
  );
  await page.addInitScript(
    ({ address, publicKey, endpoint }) => {
      let connected = false;
      const listeners = new Set();
      const account = {
        address,
        publicKey: Uint8Array.from(publicKey),
        chains: ["solana:devnet"],
        features: ["solana:signMessage", "solana:signTransaction", "solana:signAndSendTransaction"],
      };
      const sign = async (transaction) =>
        Uint8Array.from(await window.__insiderQaSignTransaction(Array.from(transaction)));
      const wallet = {
        version: "1.0.0",
        name: "INSIDER QA Wallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        chains: ["solana:devnet"],
        get accounts() {
          return connected ? [account] : [];
        },
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => {
              connected = true;
              for (const listener of listeners) listener({ accounts: [account] });
              return { accounts: [account] };
            },
          },
          "standard:disconnect": {
            version: "1.0.0",
            disconnect: async () => {
              connected = false;
              for (const listener of listeners) listener({ accounts: [] });
            },
          },
          "standard:events": {
            version: "1.0.0",
            on: (_event, listener) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          },
          "solana:signMessage": {
            version: "1.0.0",
            signMessage: async (...inputs) =>
              Promise.all(
                inputs.map(async ({ message }) => ({
                  signedMessage: message,
                  signature: Uint8Array.from(
                    await window.__insiderQaSignMessage(Array.from(message)),
                  ),
                })),
              ),
          },
          "solana:signTransaction": {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy", 0],
            signTransaction: async (...inputs) =>
              Promise.all(
                inputs.map(async ({ transaction }) => ({
                  signedTransaction: await sign(transaction),
                })),
              ),
          },
          "solana:signAndSendTransaction": {
            version: "1.0.0",
            supportedTransactionVersions: ["legacy", 0],
            signAndSendTransaction: async (...inputs) =>
              Promise.all(
                inputs.map(async ({ transaction }) => {
                  const signed = await sign(transaction);
                  const encoded = btoa(
                    Array.from(signed, (byte) => String.fromCharCode(byte)).join(""),
                  );
                  const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      jsonrpc: "2.0",
                      id: 1,
                      method: "sendTransaction",
                      params: [encoded, { encoding: "base64" }],
                    }),
                  });
                  const result = await response.json();
                  if (!response.ok || result.error || !result.result)
                    throw new Error(result.error?.message || "Transaction failed");
                  return {
                    signature: Uint8Array.from(
                      await window.__insiderQaDecodeSignature(result.result),
                    ),
                  };
                }),
              ),
          },
        },
      };
      window.addEventListener("wallet-standard:app-ready", ({ detail }) => detail.register(wallet));
    },
    {
      address: keypair.publicKey.toBase58(),
      publicKey: Array.from(keypair.publicKey.toBytes()),
      endpoint: rpcUrl,
    },
  );
  return keypair.publicKey.toBase58();
}
