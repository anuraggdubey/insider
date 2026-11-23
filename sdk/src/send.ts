import {
  type Connection,
  type Keypair,
  type PublicKey,
  type Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export type SendResult = { signature: string; ms: number };

export async function sendTx(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  { feePayer = signers[0] }: { feePayer?: Keypair } = {},
): Promise<SendResult> {
  if (!feePayer) throw new Error("A fee payer is required");
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const started = performance.now();
  const unique = [
    ...new Map([feePayer, ...signers].map((s) => [s.publicKey.toBase58(), s])).values(),
  ];
  const signature = await sendAndConfirmTransaction(connection, tx, unique, {
    commitment: "confirmed",
  });
  return { signature, ms: Math.round(performance.now() - started) };
}

export async function sendWithWallet(
  connection: Connection,
  tx: Transaction,
  wallet: { publicKey: PublicKey; signTransaction(transaction: Transaction): Promise<Transaction> },
): Promise<SendResult> {
  const blockhash = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = blockhash.blockhash;
  const started = performance.now();
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  const confirmation = await connection.confirmTransaction(
    { signature, ...blockhash },
    "confirmed",
  );
  if (confirmation.value.err)
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  return { signature, ms: Math.round(performance.now() - started) };
}
