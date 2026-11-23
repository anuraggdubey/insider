/** Public accounts to the `Snapshot` the commentary compares. Pure over decoded accounts. */
import type { PublicKey } from "@solana/web3.js";

import { seatName } from "@insider/sdk";

import type { CallSnap, FillSnap, LeakSnap, Snapshot } from "./commentary.js";

type Num = { toString(): string } | number;
const num = (value: Num) => Number(value.toString());
const FREE = "11111111111111111111111111111111";

export type Decoded = {
  table: { roundId: number; phase: Record<string, unknown> };
  board: {
    roundId: number;
    headers: Array<{
      leakId: number;
      kind: number;
      rarity: number;
      state: number;
      ownerSeat: number;
      paid: Num;
      ask: number;
      licenseAsk: Num;
      readerCount: number;
    }>;
  };
  calls: Array<{
    callId: number;
    authorSeat: number;
    state: number;
    mintedPrice: Num;
    horizonSecs: number;
    revealedDir: number;
  }>;
  tape: {
    fills: Array<{ seat: number; side: number; size: number; price: number }>;
    fillsHead: number;
  };
  seats: Array<{ owner: PublicKey; nameIdx: number }>;
  xray: { roundId: number; finalized: number; tagCount: number; scores: number[] };
};

export function takeSnapshot(decoded: Decoded): Snapshot {
  const ring = decoded.tape.fills.length;
  const head = decoded.tape.fillsHead;
  const fills: FillSnap[] = [];
  for (let n = Math.max(0, head - ring); n < head; n++) {
    const fill = decoded.tape.fills[n % ring]!;
    fills.push({ n, seat: fill.seat, side: fill.side, size: fill.size, price: fill.price / 1e6 });
  }
  const leaks: LeakSnap[] =
    decoded.board.roundId === decoded.table.roundId
      ? decoded.board.headers.map((h) => ({
          leakId: h.leakId,
          kind: h.kind,
          rarity: h.rarity,
          state: h.state,
          ownerSeat: h.ownerSeat,
          paid: num(h.paid),
          ask: h.ask,
          licenseAsk: num(h.licenseAsk),
          readerCount: h.readerCount,
        }))
      : [];
  const calls: CallSnap[] = decoded.calls.map((c) => ({
    callId: c.callId,
    author: c.authorSeat,
    state: c.state,
    mintedUsd: num(c.mintedPrice) / 1e6,
    horizon: c.horizonSecs,
    revealedDir: c.revealedDir,
  }));
  let topSeat = -1;
  let topScore = 0;
  decoded.xray.scores.slice(0, decoded.seats.length).forEach((score, seat) => {
    if (score > topScore) {
      topScore = score;
      topSeat = seat;
    }
  });
  return {
    roundId: decoded.table.roundId,
    phase: Object.keys(decoded.table.phase)[0] ?? "idle",
    names: decoded.seats.map((seat) =>
      seat.owner.toBase58() === FREE ? undefined : seatName(seat.nameIdx),
    ),
    leaks,
    calls,
    fills,
    xray: {
      roundId: decoded.xray.roundId,
      finalized: decoded.xray.finalized !== 0,
      tagCount: decoded.xray.tagCount,
      topSeat,
      topScore,
    },
  };
}
