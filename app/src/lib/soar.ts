import { sendWithWallet, type InsiderConfig } from "@insider/sdk";
import { PublicKey, type Connection, type Transaction } from "@solana/web3.js";
import type { SoarProgram } from "@magicblock-labs/soar-sdk";
import { proofs } from "./proofs";

export const DEFAULT_SOAR_LEADERBOARD = proofs.entries.find((entry) => entry.id === "soar")?.facts
  .leaderboard;

type Client = Pick<
  SoarProgram,
  "utils" | "initializePlayerAccount" | "registerPlayerEntryForLeaderBoard"
>;
type Wallet = {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
};
export type SoarReceipt = { step: "player" | "leaderboard"; signature: string };

export async function loadSoar(config: InsiderConfig, wallet: PublicKey) {
  const [{ baseConnection }, { SoarProgram }] = await Promise.all([
    import("@insider/sdk/connection"),
    import("@magicblock-labs/soar-sdk"),
  ]);
  const connection = baseConnection(config);
  const address = process.env.NEXT_PUBLIC_SOAR_LEADERBOARD || DEFAULT_SOAR_LEADERBOARD;
  if (!address) throw new Error("SOAR leaderboard is not configured.");
  const leaderboard = new PublicKey(address);
  return { connection, leaderboard, client: SoarProgram.getFromConnection(connection, wallet) };
}

export async function soarRegistered(
  connection: Connection,
  client: Client,
  wallet: PublicKey,
  leaderboard: PublicKey,
) {
  const [list] = client.utils.derivePlayerScoresListAddress(wallet, leaderboard);
  return Boolean(await connection.getAccountInfo(list, "confirmed"));
}

export async function registerSoar(
  connection: Connection,
  client: Client,
  wallet: Wallet,
  leaderboard: PublicKey,
  onReceipt: (receipt: SoarReceipt) => void,
  isCurrent: () => boolean = () => true,
) {
  const checkWallet = () => {
    if (!isCurrent()) throw new Error("Wallet changed. Reconnect and try again.");
  };
  checkWallet();
  if (await soarRegistered(connection, client, wallet.publicKey, leaderboard)) return;
  const [player] = client.utils.derivePlayerAddress(wallet.publicKey);
  if (!(await connection.getAccountInfo(player, "confirmed"))) {
    const created = await client.initializePlayerAccount(
      wallet.publicKey,
      `insider-${wallet.publicKey.toBase58().slice(0, 8)}`,
      PublicKey.default,
    );
    checkWallet();
    const { signature } = await sendWithWallet(connection, created.transaction, wallet);
    onReceipt({ step: "player", signature });
  }
  checkWallet();
  const entry = await client.registerPlayerEntryForLeaderBoard(wallet.publicKey, leaderboard);
  checkWallet();
  const { signature } = await sendWithWallet(connection, entry.transaction, wallet);
  onReceipt({ step: "leaderboard", signature });
  if (!(await soarRegistered(connection, client, wallet.publicKey, leaderboard)))
    throw new Error("Registration was confirmed, but the score account is not visible yet.");
}
