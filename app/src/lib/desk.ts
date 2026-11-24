import {
  ORACLE_FEED,
  decodeCallBook,
  decodeOraclePrice,
  decodeSeason,
  decodeSeat,
  seatName,
  tableAccounts,
  type InsiderConfig,
  type SeatAccount,
} from "@insider/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

export type CallState = "empty" | "open" | "right" | "wrong";
const STATES: CallState[] = ["empty", "open", "right", "wrong"];

export type DeskCall = {
  seat: number;
  author: string;
  callId: number;
  state: CallState;
  /** Revealed only once the Call is judged. */
  direction: "up" | "down" | null;
  stake: number;
  licenseAsk: number;
  mintedPrice: number;
  mintedAt: number;
  expiresAt: number;
  horizon: number;
  readers: number;
  mine: boolean;
};

export type AnalystRow = {
  seat: number;
  name: string;
  calls: number;
  hits: number;
  streak: number;
  bestStreak: number;
  profit: number;
};

export type DeskData = {
  /** SOL/USD from the oracle, or null when the feed was not readable. */
  price: number | null;
  priceAt: number | null;
  calls: DeskCall[];
  analysts: AnalystRow[];
  /** The connected player's seat, when they hold one. */
  mySeat: { index: number; deskChips: number; deskPosition: number } | null;
};

const num = (value: { toString(): string } | number) => Number(value.toString());
const empty = (key: PublicKey) => key.equals(PublicKey.default);

export function deriveDesk(
  accounts: {
    callBook: Uint8Array;
    season: Uint8Array;
    seats: (Uint8Array | null)[];
    oracle: Uint8Array | null;
  },
  me: PublicKey | null,
): DeskData {
  const seats: (SeatAccount | null)[] = accounts.seats.map((data) =>
    data ? decodeSeat(Buffer.from(data)) : null,
  );
  const nameOf = (index: number) => {
    const seat = seats[index];
    return seat && !empty(seat.owner) ? seatName(seat.nameIdx) : `Seat ${index + 1}`;
  };
  const book = decodeCallBook(Buffer.from(accounts.callBook));
  const calls: DeskCall[] = [];
  book.headers.forEach((header, index) => {
    const state = STATES[header.state] ?? "empty";
    if (state === "empty") return;
    const owner = seats[header.authorSeat]?.owner;
    calls.push({
      seat: header.authorSeat,
      author: nameOf(header.authorSeat),
      callId: header.callId,
      state,
      direction: state === "open" ? null : header.revealedDir > 0 ? "up" : "down",
      stake: num(header.stake),
      licenseAsk: num(header.licenseAsk),
      mintedPrice: num(header.mintedPrice) / 1e6,
      mintedAt: num(header.mintedTs),
      expiresAt: num(header.expiryTs),
      horizon: header.horizonSecs,
      readers: (header.readers as PublicKey[]).filter((reader) => !empty(reader)).length,
      mine: Boolean(me && owner && owner.equals(me)),
    });
    void index;
  });
  const season = decodeSeason(Buffer.from(accounts.season));
  const analysts = season.analysts
    .map((stats, seat) => ({
      seat,
      name: nameOf(seat),
      calls: stats.calls,
      hits: stats.hits,
      streak: stats.streak,
      bestStreak: stats.bestStreak,
      profit: num(stats.profit),
    }))
    .filter((row) => row.calls > 0)
    .sort((a, b) => b.profit - a.profit);
  const price = accounts.oracle ? decodeOraclePrice(accounts.oracle) : undefined;
  const index = me ? seats.findIndex((seat) => seat?.owner.equals(me)) : -1;
  const mine = index >= 0 ? seats[index] : null;
  return {
    price: price?.usd ?? null,
    priceAt: price?.publishTime ?? null,
    calls: calls.sort((a, b) => b.callId - a.callId),
    analysts,
    mySeat: mine
      ? { index, deskChips: num(mine.deskChips), deskPosition: num(mine.deskPosition) }
      : null,
  };
}

export async function fetchDesk(
  connection: Connection,
  config: InsiderConfig,
  me: PublicKey | null,
): Promise<DeskData | null> {
  if (!config.tableAuthority) return null;
  const a = tableAccounts(config.tableAuthority, config.programId);
  const [callBook, season, oracle, ...seats] = await connection.getMultipleAccountsInfo(
    [a.callBook, a.season, ORACLE_FEED, ...a.seats],
    "confirmed",
  );
  if (!callBook || !season) return null;
  return deriveDesk(
    {
      callBook: callBook.data,
      season: season.data,
      oracle: oracle?.data ?? null,
      seats: seats.map((info) => info?.data ?? null),
    },
    me,
  );
}
