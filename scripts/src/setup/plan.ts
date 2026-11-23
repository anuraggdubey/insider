/**
 * The setup plan: what to create and what to delegate, given what already exists. Pure, so it is
 * unit-tested; the script only reads chain state, asks this for the plan and sends it.
 * Re-running after a partial failure plans only the missing work (idempotent and resumable).
 *
 * Two plans: `planSetup` runs on the base layer (create, then delegate), `planPermissions` runs on
 * the rollup afterwards and makes the Mempool, the Future and the six vaults private.
 */
import { LEAK_SLOTS, SEAT_COUNT } from "../lib/insider.js";

export type AccountState = { exists: boolean; delegated: boolean };

export type TableState = {
  table: AccountState;
  tape: AccountState;
  callBook: AccountState;
  season: AccountState;
  market: AccountState;
  mempool: AccountState;
  future: AccountState;
  board: AccountState;
  xray: AccountState;
  vaults: AccountState[];
  seats: AccountState[];
};

export const SINGLE_ACCOUNTS = [
  "table",
  "tape",
  "callBook",
  "season",
  "market",
  "mempool",
  "future",
  "board",
  "xray",
] as const;
export type SingleAccount = (typeof SINGLE_ACCOUNTS)[number];

export type Target = SingleAccount | { seat: number } | { vault: number };

export type Step = { kind: "init" | "delegate"; target: Target };

/** One transaction worth of steps. */
export type Batch = { label: string; steps: Step[] };

/** Delegations per transaction (Phase 2, experiment E: transaction size caps it at six). */
export const DELEGATIONS_PER_TX = 6;
/** Seats created per transaction (each is a small account). */
export const SEATS_PER_INIT_TX = 5;
/** Engine accounts created per transaction (Xray is 7 KB, so the limit is allocation, not size). */
export const ENGINE_PER_INIT_TX = 3;

const none = (): AccountState => ({ exists: false, delegated: false });

export const emptyState = (): TableState => ({
  table: none(),
  tape: none(),
  callBook: none(),
  season: none(),
  market: none(),
  mempool: none(),
  future: none(),
  board: none(),
  xray: none(),
  vaults: Array.from({ length: LEAK_SLOTS }, none),
  seats: Array.from({ length: SEAT_COUNT }, none),
});

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const describeTarget = (target: Target) => {
  if (typeof target === "string") return target;
  return "seat" in target ? `seat ${target.seat}` : `vault ${target.vault}`;
};

/**
 * Batches for a table in the given state:
 *  1. the table itself (everything else is derived from it);
 *  2. tape, call book and season (one instruction each, so no stack frame holds two);
 *  3. the engine accounts (market, mempool, future, board, X-ray, six vaults), three per transaction;
 *  4. seats, five per transaction;
 *  5. delegation of everything not yet delegated, six per transaction.
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

  const engine: Step[] = [
    ...(["market", "mempool", "future", "board", "xray"] as const)
      .filter((name) => !state[name].exists)
      .map((name): Step => ({ kind: "init", target: name })),
    ...state.vaults
      .map((vault, index) => ({ vault, index }))
      .filter(({ vault }) => !vault.exists)
      .map(({ index }): Step => ({ kind: "init", target: { vault: index } })),
  ];
  chunk(engine, ENGINE_PER_INIT_TX).forEach((steps, i, all) =>
    batches.push({ label: `create engine accounts (${i + 1}/${all.length})`, steps }),
  );

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
  for (const name of SINGLE_ACCOUNTS) {
    if (name !== "season") consider(name, state[name]);
  }
  state.vaults.forEach((vault, index) => consider({ vault: index }, vault));
  state.seats.forEach((seat, index) => consider({ seat: index }, seat));
  consider("season", state.season);
  chunk(delegate, DELEGATIONS_PER_TX).forEach((steps, i, all) =>
    batches.push({ label: `delegate (${i + 1}/${all.length})`, steps }),
  );

  return batches;
}

/** True when there is nothing left to do on the base layer. */
export const isComplete = (state: TableState) => planSetup(state).length === 0;

// ---- permissions (rollup) ----------------------------------------------------------------------

/** Accounts that must be private to the keyless `nobody` member while a round is played. */
export type PrivateTarget = "mempool" | "future" | { vault: number };

/** Which of those already have a permission account on the rollup. */
export type PermissionState = {
  mempool: boolean;
  future: boolean;
  vaults: boolean[];
};

export const emptyPermissions = (): PermissionState => ({
  mempool: false,
  future: false,
  vaults: Array.from({ length: LEAK_SLOTS }, () => false),
});

/** Permissions per rollup transaction (each creates an ephemeral account, so keep it small). */
export const PERMISSIONS_PER_TX = 4;

export const describePrivate = (target: PrivateTarget) =>
  typeof target === "string" ? target : `vault ${target.vault}`;

/** Rollup batches: one `init_permission` for each private account that has none yet. */
export function planPermissions(state: PermissionState): Array<{
  label: string;
  targets: PrivateTarget[];
}> {
  const missing: PrivateTarget[] = [];
  if (!state.mempool) missing.push("mempool");
  if (!state.future) missing.push("future");
  state.vaults.forEach((has, index) => {
    if (!has) missing.push({ vault: index });
  });
  return chunk(missing, PERMISSIONS_PER_TX).map((targets, i, all) => ({
    label: `private permissions (${i + 1}/${all.length})`,
    targets,
  }));
}
