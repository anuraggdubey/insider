import {
  claimSeat,
  cupJoin,
  decodeSeat,
  sendWithWallet,
  tableAccounts,
  teeConnection,
  tx,
  type InsiderConfig,
} from "@insider/sdk";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { type Connection, PublicKey, Transaction } from "@solana/web3.js";
import type { WalletSigner } from "./floor-store";
import type { CupStatus } from "./cup";
import { PaymentNotSubmittedError } from "./payments";

export type CupProgress = {
  owner: string;
  cupId: number;
  mint: string;
  operator: string;
  buyIn: string;
  stage:
    | "ready"
    | "deposit_pending"
    | "deposited"
    | "transfer_pending"
    | "paid"
    | "join_pending"
    | "joined";
  creditsBefore?: number;
  depositSignature?: string;
  transferSignature?: string;
  joinSignature?: string;
};

export type ProgressStore = {
  read(): CupProgress | null;
  write(value: CupProgress): void;
};

export function cupProgressStore(owner: string, cupId: number): ProgressStore {
  const key = `insider:cup-payment:${owner}:${cupId}`;
  return {
    read: () => {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as CupProgress) : null;
    },
    write: (value) => localStorage.setItem(key, JSON.stringify(value)),
  };
}

export async function withCupLock<T>(owner: string, cupId: number, action: () => Promise<T>) {
  if (!navigator.locks)
    throw new Error(
      "This browser cannot safely coordinate Cup payments. Use an up-to-date browser.",
    );
  return navigator.locks.request(`insider:cup:${owner}:${cupId}`, { ifAvailable: true }, (lock) => {
    if (!lock) throw new Error("A Cup action is already in progress in another tab.");
    return action();
  });
}

export function checkCupStatus(status: CupStatus, config: InsiderConfig, cupId?: number) {
  if (!config.tableAuthority || status.operator !== config.tableAuthority.toBase58())
    throw new Error("The cup operator does not match the table authority.");
  if (!status.open || status.cupId === undefined || (cupId !== undefined && status.cupId !== cupId))
    throw new Error("This cup is not open for entries.");
  if (!Number.isInteger(status.credits) || status.credits! < 0 || BigInt(status.buyIn) <= BigInt(0))
    throw new Error("The operator returned invalid buy-in information.");
  new PublicKey(status.mint);
}

export async function humanSeats(connection: Connection, config: InsiderConfig, owner: PublicKey) {
  if (!config.tableAuthority) throw new Error("Table authority is not configured.");
  const addresses = tableAccounts(config.tableAuthority, config.programId).seats.slice(7, 10);
  const infos = await connection.getMultipleAccountsInfo(addresses, "confirmed");
  const seats = infos.map((info, offset) =>
    info ? { index: offset + 7, seat: decodeSeat(info.data) } : null,
  );
  return {
    mine: seats.find((item) => item?.seat.owner.equals(owner))?.index,
    free: seats.find((item) => item?.seat.owner.equals(PublicKey.default))?.index,
  };
}

export async function claimHumanSeat(config: InsiderConfig, wallet: WalletSigner) {
  const connection = await teeConnection(config, wallet);
  return claimHumanSeatOnConnection(config, wallet, connection);
}

export async function claimHumanSeatOnConnection(
  config: InsiderConfig,
  wallet: WalletSigner,
  connection: Connection,
) {
  const seats = await humanSeats(connection, config, wallet.publicKey);
  if (seats.mine !== undefined) return seats.mine;
  if (seats.free === undefined) throw new Error("All human seats are taken.");
  await sendWithWallet(connection, tx(claimSeat(config, wallet.publicKey, seats.free)), wallet);
  return seats.free;
}

export async function balances(base: Connection, owner: PublicKey, mint: PublicKey) {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const [lamports, account] = await Promise.all([
    base.getBalance(owner, "confirmed"),
    base.getAccountInfo(ata, "confirmed"),
  ]);
  const token = account
    ? BigInt((await base.getTokenAccountBalance(ata, "confirmed")).value.amount)
    : BigInt(0);
  return { lamports, token };
}

type PaymentClient = {
  privateBalance(mint: PublicKey): Promise<bigint>;
  deposit(mint: PublicKey, amount: bigint): Promise<string>;
  transfer(to: PublicKey, mint: PublicKey, amount: bigint): Promise<string>;
};

export async function payCup({
  wallet,
  status,
  config,
  payments,
  store,
  getStatus,
  isCurrent = () => true,
  pause = () => new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  onProgress = () => {},
}: {
  wallet: WalletSigner;
  status: CupStatus;
  config: InsiderConfig;
  payments: PaymentClient;
  store: ProgressStore;
  getStatus(): Promise<CupStatus | null>;
  isCurrent?(): boolean;
  pause?(): Promise<void>;
  onProgress?(progress: CupProgress): void;
}) {
  checkCupStatus(status, config);
  const owner = wallet.publicKey.toBase58();
  const cupId = status.cupId!;
  const mint = new PublicKey(status.mint);
  const amount = BigInt(status.buyIn);
  if (!Number.isSafeInteger(Number(amount))) throw new Error("The buy-in is too large.");
  const check = () => {
    if (!isCurrent()) throw new Error("Wallet changed; reconnect to continue.");
  };
  let progress = store.read();
  if (
    progress &&
    (progress.owner !== owner ||
      progress.cupId !== cupId ||
      progress.mint !== status.mint ||
      progress.operator !== status.operator ||
      progress.buyIn !== status.buyIn)
  )
    throw new Error(
      "Saved payment does not match this cup. Contact the operator before paying again.",
    );
  const save = (next: CupProgress) => {
    store.write(next);
    progress = next;
    onProgress(next);
  };
  if (
    progress?.stage === "transfer_pending" ||
    progress?.stage === "deposit_pending" ||
    progress?.stage === "join_pending"
  )
    throw new Error(
      "A previous transaction has an unknown result. Check your wallet and contact the operator before retrying.",
    );
  if (progress?.stage === "joined") return progress;
  if (progress?.stage !== "paid") {
    check();
    let available = await payments.privateBalance(mint);
    if (available < amount) {
      if (progress?.stage === "deposited")
        throw new Error("Your deposit has not reached the private balance yet. Retry later.");
      const initial: CupProgress = {
        owner,
        cupId,
        mint: status.mint,
        operator: status.operator,
        buyIn: status.buyIn,
        stage: "deposit_pending",
      };
      save(initial);
      check();
      let signature: string;
      try {
        signature = await payments.deposit(mint, amount - available);
      } catch (error) {
        if (error instanceof PaymentNotSubmittedError) save({ ...initial, stage: "ready" });
        throw error;
      }
      save({ ...initial, stage: "deposited", depositSignature: signature });
      for (let i = 0; i < 20 && available < amount; i++) {
        check();
        await pause();
        available = await payments.privateBalance(mint);
      }
      if (available < amount)
        throw new Error(
          "Deposit submitted, but the private balance is not visible yet. Retry later.",
        );
    }
    check();
    const fresh = await getStatus();
    if (!fresh)
      throw new Error("Cup operator offline. Your private balance remains in your wallet.");
    checkCupStatus(fresh, config, cupId);
    if (fresh.mint !== status.mint || fresh.buyIn !== status.buyIn)
      throw new Error("The buy-in changed. Review the new cup details before paying.");
    const resumeStage = progress?.stage === "deposited" ? "deposited" : "ready";
    const pending: CupProgress = {
      ...progress,
      owner,
      cupId,
      mint: status.mint,
      operator: status.operator,
      buyIn: status.buyIn,
      stage: "transfer_pending",
      creditsBefore: fresh.credits,
    };
    check();
    save(pending);
    let signature: string;
    try {
      signature = await payments.transfer(new PublicKey(status.operator), mint, amount);
    } catch (error) {
      if (error instanceof PaymentNotSubmittedError) save({ ...pending, stage: resumeStage });
      throw error;
    }
    save({ ...pending, stage: "paid", transferSignature: signature });
  }
  for (let i = 0; i < 20; i++) {
    check();
    const next = await getStatus();
    if (next) {
      checkCupStatus(next, config, cupId);
      if ((next.credits ?? 0) > (progress!.creditsBefore ?? 0)) return progress!;
    }
    await pause();
  }
  throw new Error("Buy-in sent; waiting for an operator credit. Retry without paying again.");
}

export async function submitCupJoin(
  config: InsiderConfig,
  wallet: WalletSigner,
  seat: number,
  operatorUrl: string,
  connection: Connection,
  store: ProgressStore,
  isCurrent: () => boolean = () => true,
) {
  if (seat < 7 || seat > 9) throw new Error("A human seat is required.");
  const progress = store.read();
  if (!progress || progress.stage !== "paid" || progress.owner !== wallet.publicKey.toBase58())
    throw new Error("Pay the buy-in before joining.");
  const transaction = new Transaction().add(cupJoin(config, wallet.publicKey, seat));
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  if (!isCurrent()) throw new Error("Wallet changed; reconnect to continue.");
  const signed = await wallet.signTransaction(transaction);
  if (!isCurrent()) throw new Error("Wallet changed; reconnect to continue.");
  const encoded = signed.serialize({ requireAllSignatures: false }).toString("base64");
  store.write({ ...progress, stage: "join_pending" });
  const response = await fetch(`${operatorUrl.replace(/\/$/, "")}/cup/cosign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transactionBase64: encoded }),
  });
  const result = (await response.json()) as { signature?: string; error?: string };
  if (!response.ok || !result.signature) {
    if (response.status >= 400 && response.status < 500) store.write(progress);
    throw new Error(
      result.error || "Join outcome unknown. Check with the operator before retrying.",
    );
  }
  store.write({ ...progress, stage: "joined", joinSignature: result.signature });
  return result.signature;
}
