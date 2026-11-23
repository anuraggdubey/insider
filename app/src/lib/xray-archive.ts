import {
  BANKROLL_CHIPS,
  CLOSING_END_TICK,
  seatName,
  type TableSnapshot,
  type XrayAccount,
} from "@insider/sdk";
import { PublicKey } from "@solana/web3.js";

type Header = XrayAccount["leaks"][number]["header"];
export type ArchivedHeader = Omit<Header, "readers"> & { readers: string[] };
export type PayloadOrder = {
  seat: number;
  lane: number;
  sideSize: number;
  landTick: number;
  seq: number;
};
export type ArchivedLeak = Omit<XrayAccount["leaks"][number], "header" | "orders"> & {
  header: ArchivedHeader;
  orders: PayloadOrder[];
};
export type ArchivedXray = Omit<XrayAccount, "leaks"> & { leaks: ArchivedLeak[] };
export type ArchivedSeat = {
  index: number;
  owner: string;
  name: string;
  kind: string;
  free: boolean;
  score: number | null;
};
export type ArchivedRound = {
  round: number;
  authority: string;
  fixture: boolean;
  capturedAt: number;
  xray: ArchivedXray;
  history: number[];
  seats: ArchivedSeat[];
  headers: ArchivedHeader[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type ClosingScores = {
  round: number;
  authority: string;
  owners: string[];
  scores: (number | null)[];
};
const LIMIT = 30;

const key = (fixture: boolean) => `insider:xray:${fixture ? "fixture:" : ""}v1`;
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const publicHeader = (header: Header): ArchivedHeader => ({
  ...header,
  readers: header.readers.map((reader: PublicKey) => reader.toBase58()),
});

export function loadRounds(
  fixture: boolean,
  storage: StorageLike | null = browserStorage(),
): ArchivedRound[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key(fixture)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is ArchivedRound =>
          !!item &&
          typeof item.round === "number" &&
          typeof item.authority === "string" &&
          item.fixture === fixture &&
          item.xray?.finalized === 1 &&
          item.xray.roundId === item.round &&
          Array.isArray(item.xray.orders) &&
          Array.isArray(item.xray.leaks) &&
          Array.isArray(item.xray.tags) &&
          item.xray.leaks.every(
            (leak: unknown) =>
              !!leak &&
              typeof leak === "object" &&
              "header" in leak &&
              !!leak.header &&
              "fields" in leak &&
              Array.isArray(leak.fields) &&
              "orders" in leak &&
              Array.isArray(leak.orders),
          ) &&
          Array.isArray(item.history) &&
          Array.isArray(item.seats) &&
          Array.isArray(item.headers),
      )
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function findRound(
  fixture: boolean,
  authority?: string,
  round?: number,
  storage: StorageLike | null = browserStorage(),
): ArchivedRound | null {
  return (
    loadRounds(fixture, storage).find(
      (item) =>
        (authority === undefined || item.authority === authority) &&
        (round === undefined || item.round === round),
    ) ?? null
  );
}

export function saveRound(
  round: ArchivedRound,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false;
  const previous = loadRounds(round.fixture, storage);
  const old = previous.find(
    (item) => item.authority === round.authority && item.round === round.round,
  );
  if (old) {
    round = {
      ...round,
      seats: round.seats.map((seat) => {
        const prior = old.seats.find(
          (item) => item.index === seat.index && item.owner === seat.owner,
        );
        return { ...seat, score: seat.score ?? prior?.score ?? null };
      }),
    };
  }
  const next = [
    round,
    ...previous.filter((item) => item.authority !== round.authority || item.round !== round.round),
  ]
    .sort((a, b) => b.round - a.round || b.capturedAt - a.capturedAt)
    .slice(0, LIMIT);
  try {
    storage.setItem(key(round.fixture), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function createRoundObserver(
  fixture: boolean,
  storage: StorageLike | null = browserStorage(),
) {
  let closing: ClosingScores | null = null;
  return (snapshot: TableSnapshot): ArchivedRound | null => {
    const { table, market, board, seats, xray } = snapshot;
    if (
      !xray ||
      xray.roundId !== table.roundId ||
      market.roundId !== table.roundId ||
      board.roundId !== table.roundId
    )
      return null;
    const authority = table.authority.toBase58();
    if (
      !xray.finalized &&
      table.tick >= CLOSING_END_TICK &&
      market.lastTick >= CLOSING_END_TICK &&
      seats.every((seat) => seat.position === 0)
    ) {
      closing = {
        round: table.roundId,
        authority,
        owners: seats.map((seat) => seat.owner.toBase58()),
        scores: seats.map((seat) =>
          seat.owner.equals(PublicKey.default)
            ? null
            : Number(BigInt(seat.chips.toString()) - BigInt(BANKROLL_CHIPS)),
        ),
      };
    }
    if (!xray.finalized) return null;
    const validScores =
      closing?.round === table.roundId && closing.authority === authority ? closing : null;
    const record: ArchivedRound = {
      round: xray.roundId,
      authority,
      fixture,
      capturedAt: Date.now(),
      xray: {
        ...xray,
        orders: xray.orders.slice(0, xray.orderCount).map((order) => ({ ...order })),
        leaks: xray.leaks.slice(0, xray.leakCount).map((leak) => ({
          ...leak,
          header: publicHeader(leak.header),
          fields: [...leak.fields],
          orders: leak.orders
            .slice(0, leak.orderCount)
            .map((order: PayloadOrder) => ({ ...order })),
        })),
        tags: xray.tags.slice(0, xray.tagCount).map((tag) => ({ ...tag })),
      },
      history: market.history.slice(0, CLOSING_END_TICK + 1),
      seats: seats.map((seat, index) => ({
        index: seat.index,
        owner: seat.owner.toBase58(),
        name: seatName(seat.nameIdx),
        kind: Object.keys(seat.kind)[0] ?? "unknown",
        free: seat.owner.equals(PublicKey.default),
        score:
          validScores?.owners[index] === seat.owner.toBase58()
            ? (validScores.scores[index] ?? null)
            : null,
      })),
      headers: board.headers.map(publicHeader),
    };
    saveRound(record, storage);
    return findRound(fixture, authority, record.round, storage) ?? record;
  };
}
