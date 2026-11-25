/**
 * The pure parts of the Alpha Cup operator: counting buy-ins, splitting the pot and checking that a
 * transaction handed to us for co-signing is exactly a `cup_join` and nothing else.
 */
import { PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";

import { type InsiderConfig, cupJoin, tableAccounts } from "@insider/sdk";

export const FAUCET_INTERVAL_MS = 60 * 60 * 1000;

export class FaucetLimiter {
  constructor(private readonly timestamps: Record<string, number>) {}

  claim(owner: string, now = Date.now()) {
    const previous = this.timestamps[owner];
    if (previous !== undefined && now - previous < FAUCET_INTERVAL_MS) return false;
    this.timestamps[owner] = now;
    return true;
  }
}

/**
 * Buy-ins arrive as private transfers whose sender is not visible, so the operator counts credits: each
 * increase of its private balance by one buy-in is one entry it may co-sign. Payouts lower the balance
 * and must not look like a negative credit: call `rebase` after paying.
 */
export class CreditLedger {
  private baseline: bigint | undefined;
  private pending = 0n;
  credits = 0;

  constructor(private readonly buyIn: bigint) {}

  /** Feeds a balance reading. The first reading only sets the baseline (earlier money is not credit). */
  observe(balance: bigint) {
    if (this.baseline === undefined) {
      this.baseline = balance;
      return;
    }
    if (balance > this.baseline) {
      this.pending += balance - this.baseline;
      const whole = this.pending / this.buyIn;
      this.credits += Number(whole);
      this.pending -= whole * this.buyIn;
    }
    this.baseline = balance;
  }

  /** After the operator moved money out (prizes, fee) or in on purpose. */
  rebase(balance: bigint) {
    this.baseline = balance;
  }

  /** Spends one credit; false when there is none. */
  spend() {
    if (this.credits <= 0) return false;
    this.credits -= 1;
    return true;
  }

  save() {
    return {
      baseline: this.baseline?.toString() ?? null,
      pending: this.pending.toString(),
      credits: this.credits,
    };
  }

  load(saved: { baseline: string | null; pending: string; credits: number }) {
    this.baseline = saved.baseline === null ? undefined : BigInt(saved.baseline);
    this.pending = BigInt(saved.pending);
    this.credits = saved.credits;
  }
}

export type Payout = { prizes: bigint[]; fee: bigint; pot: bigint };

/**
 * Splits the pot: the platform fee first, then the prize pool by the shares the program fixed
 * (basis points per place). Rounding dust goes to the fee, so the parts always add up to the pot.
 */
export function payouts(entrants: number, buyIn: bigint, feeBps: number, shares: number[]): Payout {
  const pot = BigInt(entrants) * buyIn;
  const fee = (pot * BigInt(feeBps)) / 10_000n;
  const pool = pot - fee;
  const prizes = shares.map((bps) => (pool * BigInt(bps)) / 10_000n);
  const dust = pool - prizes.reduce((sum, prize) => sum + prize, 0n);
  return { prizes, fee: fee + dust, pot };
}

export type JoinCheck =
  { ok: true; owner: PublicKey; seat: number } | { ok: false; reason: string };

/**
 * Accepts only a one-instruction `cup_join` for a seat, with the right accounts, signed by the seat
 * owner and not yet by the operator. The operator then adds its signature.
 */
export function verifyJoin(
  transactionBase64: string,
  config: InsiderConfig,
  operator: PublicKey,
): JoinCheck {
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(transactionBase64, "base64"));
  } catch {
    return { ok: false, reason: "not a transaction" };
  }
  if (tx.instructions.length !== 1) return { ok: false, reason: "expected one instruction" };
  const ix = tx.instructions[0]!;
  if (!ix.programId.equals(config.programId)) return { ok: false, reason: "wrong program" };
  if (ix.data.length !== 9) return { ok: false, reason: "not a cup_join" };
  const seat = ix.data[8]!;
  const owner = ix.keys[0]?.pubkey;
  if (!owner) return { ok: false, reason: "no owner" };
  let expected;
  try {
    expected = cupJoin({ ...config, tableAuthority: operator }, owner, seat);
  } catch {
    return { ok: false, reason: "invalid seat" };
  }
  const same =
    ix.data.equals(expected.data) &&
    ix.keys.length === expected.keys.length &&
    ix.keys.every(
      (key, i) =>
        key.pubkey.equals(expected.keys[i]!.pubkey) && key.isSigner === expected.keys[i]!.isSigner,
    );
  if (!same) return { ok: false, reason: "not a cup_join for this table" };
  if (!tableAccounts(operator, config.programId).table.equals(ix.keys[2]!.pubkey)) {
    return { ok: false, reason: "another table" };
  }
  // the owner has to have signed this exact message
  const message = tx.serializeMessage();
  const signature = tx.signatures.find((s) => s.publicKey.equals(owner))?.signature;
  if (!signature || !nacl.sign.detached.verify(message, signature, owner.toBytes())) {
    return { ok: false, reason: "the seat owner has not signed" };
  }
  return { ok: true, owner, seat };
}
