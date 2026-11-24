import { decodeCup, decodeSeat, seatName, tableAccounts, type InsiderConfig } from "@insider/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

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

const empty = (key: PublicKey) => key.equals(PublicKey.default);
const short = (key: PublicKey) => `${key.toBase58().slice(0, 4)}…${key.toBase58().slice(-4)}`;

/** The cup operator's public status; null when it cannot be reached. */
export async function fetchCupStatus(url: string): Promise<CupStatus | null> {
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/cup/status`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as CupStatus) : null;
  } catch {
    return null;
  }
}

/** The Cup account and the seats' names, read from the private rollup (both are public data). */
export async function fetchCup(
  connection: Connection,
  config: InsiderConfig,
): Promise<CupData | null> {
  if (!config.tableAuthority) return null;
  const a = tableAccounts(config.tableAuthority, config.programId);
  const [cupInfo, ...seatInfos] = await connection.getMultipleAccountsInfo(
    [a.cup, ...a.seats],
    "confirmed",
  );
  if (!cupInfo) return null;
  const cup = decodeCup(cupInfo.data);
  const seats = seatInfos.map((info) => (info ? decodeSeat(info.data) : null));
  const nameOf = (owner: PublicKey) => {
    const seat = seats.find((candidate) => candidate?.owner.equals(owner));
    return seat ? seatName(seat.nameIdx) : short(owner);
  };
  return {
    cupId: cup.cupId,
    roundsRecorded: cup.roundsRecorded,
    settled: cup.settled,
    entrants: cup.entrants,
    entries: cup.entries
      .filter((entry) => entry.joined && !empty(entry.owner))
      .map((entry) => ({
        name: nameOf(entry.owner),
        owner: entry.owner.toBase58(),
        seat: entry.seat,
        score: Number(entry.score.toString()),
      }))
      .sort((a, b) => b.score - a.score),
    winners: cup.winners
      .map((owner, index) => ({ owner, bps: cup.winnerBps[index] ?? 0 }))
      .filter((winner) => !empty(winner.owner) && winner.bps > 0)
      .map((winner) => ({
        name: nameOf(winner.owner),
        owner: winner.owner.toBase58(),
        bps: winner.bps,
      })),
  };
}

/** Prize pool after the platform fee, in tokens, and each winner's share of it. */
export function prizePool(entrants: number, buyIn: string, feeBps: number) {
  const pot = BigInt(buyIn) * BigInt(entrants);
  const fee = (pot * BigInt(feeBps)) / BigInt(10_000);
  return { pot, fee, prizes: pot - fee };
}

export const tokens = (raw: bigint) =>
  (Number(raw) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", { maximumFractionDigits: 2 });
