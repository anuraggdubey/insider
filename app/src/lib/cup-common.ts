export type CupStatus = {
  cupId?: number;
  open?: boolean;
  roundsRecorded?: number;
  settled?: boolean;
  entrants?: number;
  credits?: number;
  buyIn: string;
  feeBps: number;
  mint: string;
  operator: string;
  history: Array<{
    cup: number;
    entrants: number;
    pot: string;
    fee: string;
    prizes: Array<{ to: string; amount: string; signature: string }>;
    closed: string;
  }>;
};

export type CupData = {
  cupId: number;
  roundsRecorded: number;
  settled: boolean;
  entrants: number;
  entries: Array<{ name: string; owner: string; seat: number; score: number }>;
  winners: Array<{ name: string; owner: string; bps: number }>;
};

export const CUP_ROUNDS = 5;
export const TOKEN_DECIMALS = 6;

export async function fetchCupStatus(url: string): Promise<CupStatus | null> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/cup/status`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as CupStatus) : null;
  } catch {
    return null;
  }
}

export function prizePool(entrants: number, buyIn: string, feeBps: number) {
  const pot = BigInt(buyIn) * BigInt(entrants);
  const fee = (pot * BigInt(feeBps)) / BigInt(10_000);
  return { pot, fee, prizes: pot - fee };
}

export const tokens = (raw: bigint) =>
  (Number(raw) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", { maximumFractionDigits: 2 });
