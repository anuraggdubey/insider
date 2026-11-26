/**
 * Which seat a newcomer gets. Kept apart from `floor-actions` so screens can ask "is there a
 * seat?" without loading the transaction code.
 */
import type { TableSnapshot } from "@insider/sdk";
import { PublicKey } from "@solana/web3.js";

/** Ticks without a ping or trade after which a seat's holder counts as gone (`SEAT_IDLE_TICKS`). */
const SEAT_IDLE_TICKS = 60;

type SnapshotSeat = TableSnapshot["seats"][number];

/**
 * The seat a newcomer can claim, mirroring `claim_seat`: a free human seat (8-10), then a human seat
 * whose holder is gone, then a bot seat whose bot is idle. Only flat seats (no position, nothing
 * queued) are ever handed over. Human holders are gone when idle this round or last seen in an
 * earlier round (the tick restarts every round); bots only by idling this round.
 */
export function pickSeat(snapshot: Pick<TableSnapshot, "seats" | "table">): SnapshotSeat | null {
  const tick = snapshot.table.tick;
  const free = (seat: SnapshotSeat) => seat.owner.equals(PublicKey.default);
  const flat = (seat: SnapshotSeat) => seat.position === 0 && seat.pendingCount === 0;
  const humanGone = (seat: SnapshotSeat) =>
    seat.lastSeenTick > tick || tick - seat.lastSeenTick >= SEAT_IDLE_TICKS;
  const botIdle = (seat: SnapshotSeat) =>
    seat.lastSeenTick <= tick && tick - seat.lastSeenTick >= SEAT_IDLE_TICKS;
  const humans = snapshot.seats.slice(7, 10);
  const bots = snapshot.seats.slice(0, 5);
  return (
    humans.find(free) ??
    humans.find((seat) => humanGone(seat) && flat(seat)) ??
    bots.find(free) ??
    bots
      .filter((seat) => botIdle(seat) && flat(seat))
      .sort((a, b) => a.lastSeenTick - b.lastSeenTick)[0] ??
    null
  );
}
