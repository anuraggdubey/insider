import {
  DROP_EVERY_TICKS,
  DROPS_PER_ROUND,
  FIRST_DROP_TICK,
  MAX_LIVE_LEAKS,
  TICK_MILLIS,
} from "@insider/sdk/constants";
import type { TableSnapshot } from "@insider/sdk";

export function nextLeakDrop(
  board: Pick<TableSnapshot["board"], "roundId" | "dropIndex" | "headers">,
  round: number,
  tick: number,
  phase: string,
) {
  if (phase !== "live" || board.roundId !== round || board.dropIndex >= DROPS_PER_ROUND)
    return null;
  const nextTick = FIRST_DROP_TICK + board.dropIndex * DROP_EVERY_TICKS;
  if (nextTick <= tick) return null;
  if (
    board.headers.filter((header) => header.state >= 1 && header.state <= 4).length >=
    MAX_LIVE_LEAKS
  )
    return null;
  const slot = board.headers.findIndex(
    (header) =>
      header.state === 0 ||
      (header.state === 5 && header.readerCount === 0 && nextTick > header.windowEnd),
  );
  if (slot < 0) return null;
  const seconds = Math.ceil(((nextTick - tick) * TICK_MILLIS) / 1000);
  return { slot, time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` };
}
