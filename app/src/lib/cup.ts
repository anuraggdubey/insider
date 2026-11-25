import { decodeCup, decodeSeat, seatName, tableAccounts, type InsiderConfig } from "@insider/sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import type { CupData } from "./cup-common";

export { CUP_ROUNDS, TOKEN_DECIMALS, fetchCupStatus, prizePool, tokens } from "./cup-common";
export type { CupData, CupStatus } from "./cup-common";

const empty = (key: PublicKey) => key.equals(PublicKey.default);
const short = (key: PublicKey) => `${key.toBase58().slice(0, 4)}…${key.toBase58().slice(-4)}`;

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
