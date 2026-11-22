/**
 * The setup plan: what to create and what to delegate, given what already exists. Pure, so it is
 * unit-tested; the script only reads chain state, asks this for the plan and sends it.
 * Re-running after a partial failure plans only the missing work (idempotent and resumable).
 */
import { SEAT_COUNT } from "../lib/insider.js";

export type AccountState = { exists: boolean; delegated: boolean };

export type TableState = {
  table: AccountState;
  tape: AccountState;
  callBook: AccountState;
  season: AccountState;
  seats: AccountState[];
};

export type Target = "table" | "tape" | "callBook" | "season" | { seat: number };

export type Step = { kind: "init" | "delegate"; target: Target };

/** One transaction worth of steps. */
export type Batch = { label: string; steps: Step[] };

/** Delegations per transaction (Phase 2, experiment E: transaction size caps it at six). */
export const DELEGATIONS_PER_TX = 6;
/** Seats created per transaction (each is a small account). */
export const SEATS_PER_INIT_TX = 5;

export const emptyState = (): TableState => ({
  table: { exists: false, delegated: false },
  tape: { exists: false, delegated: false },
  callBook: { exists: false, delegated: false },
  season: { exists: false, delegated: false },
  seats: Array.from({ length: SEAT_COUNT }, () => ({ exists: false, delegated: false })),
});

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const describeTarget = (target: Target) =>
  typeof target === "string" ? target : `seat ${target.seat}`;

/**
 * Batches for a table in the given state:
 *  1. the table itself (everything else is derived from it);
 *  2. tape, call book and season (one instruction each, so no stack frame holds two);
 *  3. seats, five per transaction;
 *  4. delegation of everything not yet delegated, six per transaction.
 */
export function planSetup(state: TableState): Batch[] {
  const batches: Batch[] = [];

  if (!state.table.exists) {
    batches.push({ label: "create table", steps: [{ kind: "init", target: "table" }] });
  }

  const big = (["tape", "callBook", "season"] as const)
    .filter((name) => !state[name].exists)
    .map((name): Step => ({ kind: "init", target: name }));
  if (big.length > 0) batches.push({ label: "create tape, call book, season", steps: big });

  const missingSeats = state.seats
    .map((seat, index) => ({ seat, index }))
    .filter(({ seat }) => !seat.exists)
    .map(({ index }): Step => ({ kind: "init", target: { seat: index } }));
  chunk(missingSeats, SEATS_PER_INIT_TX).forEach((steps, i, all) =>
    batches.push({ label: `create seats (${i + 1}/${all.length})`, steps }),
  );

  // delegation order: table first, season last (it is committed on its own every epoch)
  const delegate: Step[] = [];
  const consider = (target: Target, account: AccountState) => {
    if (!account.delegated) delegate.push({ kind: "delegate", target });
  };
  consider("table", state.table);
  consider("tape", state.tape);
  consider("callBook", state.callBook);
  state.seats.forEach((seat, index) => consider({ seat: index }, seat));
  consider("season", state.season);
  chunk(delegate, DELEGATIONS_PER_TX).forEach((steps, i, all) =>
    batches.push({ label: `delegate (${i + 1}/${all.length})`, steps }),
  );

  return batches;
}

/** True when there is nothing left to do. */
export const isComplete = (state: TableState) => planSetup(state).length === 0;
