import {
  decodeSeason,
  decodeSeat,
  seatName,
  tableAccounts,
  type InsiderConfig,
  type SeasonAccount,
  type SeatAccount,
} from "@insider/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

export type SeasonData = {
  season: SeasonAccount;
  seats: (SeatAccount | null)[];
};

export const shortKey = (key: PublicKey) => {
  const text = key.toBase58();
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
};

export async function fetchSeason(
  connection: Connection,
  config: InsiderConfig,
): Promise<SeasonData | null> {
  if (!config.tableAuthority) return null;
  const addresses = tableAccounts(config.tableAuthority, config.programId);
  const [season, ...seats] = await connection.getMultipleAccountsInfo(
    [addresses.season, ...addresses.seats],
    "confirmed",
  );
  if (!season) return null;
  return {
    season: decodeSeason(season.data),
    seats: seats.map((info) => (info ? decodeSeat(info.data) : null)),
  };
}

export function deriveSeason({ season, seats }: SeasonData, identities: PublicKey[] = []) {
  const isYou = (owner: PublicKey) => identities.some((key) => key.equals(owner));
  const name = (owner: PublicKey) => {
    const seat = seats.find((candidate) => candidate?.owner.equals(owner));
    return seat ? seatName(seat.nameIdx) : shortKey(owner);
  };
  const leaderboard = season.leaderboard
    .filter((entry) => !entry.owner.equals(PublicKey.default))
    .map((entry, index) => ({
      rank: index + 1,
      owner: entry.owner,
      name: name(entry.owner),
      score: BigInt(entry.score.toString()),
      rounds: entry.rounds,
      isYou: isYou(entry.owner),
    }));
  const analysts = season.analysts.map((stats, index) => {
    const seat = seats[index];
    const occupied = seat && !seat.owner.equals(PublicKey.default);
    return {
      index,
      name: occupied ? seatName(seat.nameIdx) : `Seat ${index + 1}`,
      owner: occupied ? seat.owner : null,
      isYou: Boolean(occupied && isYou(seat.owner)),
      calls: stats.calls,
      hits: stats.hits,
      streak: stats.streak,
      bestStreak: stats.bestStreak,
      profit: BigInt(stats.profit.toString()),
    };
  });
  return { epoch: season.epoch, roundsPlayed: season.roundsPlayed, leaderboard, analysts };
}
