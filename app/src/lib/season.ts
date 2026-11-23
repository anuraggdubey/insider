import { BN } from "@anchor-lang/core";
import {
  decodeSeason,
  decodeSeat,
  seatName,
  tableAccounts,
  type InsiderConfig,
  type SeasonAccount,
  type SeatAccount,
  type TableSnapshot,
} from "@insider/sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { createFixture } from "./fixture";

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

export function fixtureSeason(
  existingSeats?: TableSnapshot["seats"],
  viewer?: PublicKey | null,
): SeasonData {
  const seats = existingSeats ?? createFixture().snapshot.seats;
  const outsiders = [
    new PublicKey(new Uint8Array(32).fill(55)),
    new PublicKey(new Uint8Array(32).fill(67)),
  ];
  const entries: [PublicKey, number, number][] = [
    [seats[4]!.owner, 1824, 18],
    [seats[6]!.owner, 1362, 15],
    [outsiders[0]!, 1058, 9],
    [seats[1]!.owner, 892, 16],
    [seats[5]!.owner, 706, 14],
    [seats[2]!.owner, 391, 11],
    [outsiders[1]!, 128, 5],
  ];
  const player = seats.slice(7).find((seat) => !seat.owner.equals(PublicKey.default));
  const playerOwner = player?.owner ?? viewer;
  if (playerOwner && !entries.some(([owner]) => owner.equals(playerOwner))) {
    entries.push([playerOwner, 621, 8]);
    entries.sort((a, b) => b[1] - a[1]);
  }
  return {
    seats,
    season: {
      epoch: 4,
      roundsPlayed: 24,
      leaderboard: Array.from({ length: 20 }, (_, index) => {
        const entry = entries[index];
        return {
          owner: entry?.[0] ?? PublicKey.default,
          score: new BN(entry?.[1] ?? 0),
          rounds: entry?.[2] ?? 0,
        };
      }),
      analysts: Array.from({ length: 10 }, (_, index) => ({
        calls: index === 5 ? 31 : index === 6 ? 28 : 0,
        hits: index === 5 ? 20 : index === 6 ? 17 : 0,
        streak: index === 5 ? 3 : index === 6 ? 2 : 0,
        bestStreak: index === 5 ? 7 : index === 6 ? 5 : 0,
        profit: new BN(index === 5 ? 482 : index === 6 ? -94 : 0),
      })),
      bump: 0,
    },
  };
}
