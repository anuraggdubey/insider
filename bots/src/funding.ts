/**
 * Funding plan: top each wallet up to a target balance, never overspend the treasury, and report
 * what could not be afforded. Pure, so it is unit-tested; `fund.ts` reads balances and sends it.
 */

export type Wallet = { name: string; balance: number };
export type Transfer = { name: string; lamports: number };
export type FundingPlan = {
  transfers: Transfer[];
  /** Wallets that stay below target because the treasury ran out. */
  short: Transfer[];
  total: number;
};

export const SOL = 1_000_000_000;
/** What each bot or AI wallet needs on devnet for rent and fees (spec 4.3: 0.05 SOL). */
export const DEFAULT_TARGET = 0.05 * SOL;
/** The treasury always keeps this much so it can still pay fees. */
export const TREASURY_RESERVE = 0.2 * SOL;
/** Transfers below this are not worth a transaction. */
export const MIN_TRANSFER = 0.005 * SOL;

export function planFunding(
  wallets: Wallet[],
  treasuryBalance: number,
  target = DEFAULT_TARGET,
  reserve = TREASURY_RESERVE,
): FundingPlan {
  let budget = Math.max(0, treasuryBalance - reserve);
  const transfers: Transfer[] = [];
  const short: Transfer[] = [];
  for (const wallet of wallets) {
    const need = target - wallet.balance;
    if (need < MIN_TRANSFER) continue;
    if (budget >= need) {
      transfers.push({ name: wallet.name, lamports: need });
      budget -= need;
    } else {
      short.push({ name: wallet.name, lamports: need });
    }
  }
  return { transfers, short, total: transfers.reduce((sum, t) => sum + t.lamports, 0) };
}
