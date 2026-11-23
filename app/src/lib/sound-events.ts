import type { TableSnapshot } from "@insider/sdk";

export type FloorSoundState = { round: number; leakIds: Set<number>; fillsHead: number };

export function crossedSandwich(previous: number, tick: number, exits: number[]) {
  return tick > previous && exits.some((exit) => exit > previous && exit <= tick);
}

export function floorSoundEvents(
  previous: FloorSoundState | null,
  snapshot: TableSnapshot,
  mySeat?: number,
) {
  const { table, board, tape } = snapshot;
  const next: FloorSoundState = {
    round: table.roundId,
    leakIds: new Set(
      board.roundId === table.roundId
        ? board.headers.filter((header) => header.state !== 0).map((header) => header.leakId)
        : [],
    ),
    fillsHead: tape.fillsHead,
  };
  if (!previous || previous.round !== next.round) return { next, drop: false, fill: false };
  const drop = [...next.leakIds].some((id) => !previous.leakIds.has(id));
  const delta = (next.fillsHead - previous.fillsHead) >>> 0;
  const count = delta > 0x7fffffff ? 0 : Math.min(delta, tape.fills.length);
  const fill =
    mySeat !== undefined &&
    Array.from(
      { length: count },
      (_, index) => tape.fills[((next.fillsHead - index - 1) >>> 0) % tape.fills.length],
    ).some((item) => item?.seat === mySeat);
  return { next, drop, fill };
}
