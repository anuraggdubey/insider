/**
 * Client helpers for the game program: PDA derivation, the constants that mirror
 * `programs/insider/src/constants.rs`, and a typed Anchor program. This moves into `sdk/` when
 * Misbah creates it (task B-SDK-1); until then the setup script and the bots import it from here.
 */
import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import idl from "../../../programs/idl/insider.json" with { type: "json" };
import { permissionPdaFromAccount } from "@magicblock-labs/ephemeral-rollups-sdk";

import { config } from "./config.js";

export { permissionPdaFromAccount };

// Mirrors of the Rust constants. `scripts/test/insider.test.ts` checks they have not drifted.
export const SEEDS = {
  board: "board",
  future: "future",
  leak: "leak",
  market: "market",
  mempool: "mempool",
  xray: "xray",
  callBook: "callbook",
  season: "season",
  seat: "seat",
  table: "table",
  tape: "tape",
} as const;
export const SEAT_COUNT = 10;
export const LEAK_SLOTS = 6;
/** Market kinds: the Floor trades the round, the Desk is for the oracle Calls. */
export const MARKET_FLOOR = 0;
export const MARKET_DESK = 1;
export const SLOTS_PER_TICK = 50;
export const TICK_MILLIS = 500;
export const MAX_TASK_ITERATIONS = 1_200;

export const insiderProgram = (connection: Connection, payer: Keypair) =>
  new Program(
    { ...(idl as Idl), address: config.programId.toBase58() },
    new AnchorProvider(connection, new Wallet(payer), {}),
  );

const find = (seeds: Array<Buffer | Uint8Array>, programId = config.programId) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export const tablePda = (authority: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.table), authority.toBuffer()], programId);

export const tapePda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.tape), table.toBuffer()], programId);

export const callBookPda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.callBook), table.toBuffer()], programId);

export const seasonPda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.season), table.toBuffer()], programId);

export const seatPda = (table: PublicKey, index: number, programId = config.programId) =>
  find([Buffer.from(SEEDS.seat), table.toBuffer(), Buffer.from([index])], programId);

/** Every account the setup script creates and delegates, in order. */
export type TableAccounts = {
  table: PublicKey;
  tape: PublicKey;
  callBook: PublicKey;
  season: PublicKey;
  market: PublicKey;
  mempool: PublicKey;
  future: PublicKey;
  board: PublicKey;
  xray: PublicKey;
  vaults: PublicKey[];
  seats: PublicKey[];
};

export function tableAccounts(authority: PublicKey, programId = config.programId): TableAccounts {
  const table = tablePda(authority, programId);
  return {
    table,
    tape: tapePda(table, programId),
    callBook: callBookPda(table, programId),
    season: seasonPda(table, programId),
    market: marketPda(table, MARKET_FLOOR, programId),
    mempool: mempoolPda(table, programId),
    future: futurePda(table, programId),
    board: boardPda(table, programId),
    xray: xrayPda(table, programId),
    vaults: Array.from({ length: LEAK_SLOTS }, (_, i) => leakVaultPda(table, i, programId)),
    seats: Array.from({ length: SEAT_COUNT }, (_, i) => seatPda(table, i, programId)),
  };
}

export const marketPda = (table: PublicKey, kind = MARKET_FLOOR, programId = config.programId) =>
  find([Buffer.from(SEEDS.market), table.toBuffer(), Buffer.from([kind])], programId);

export const mempoolPda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.mempool), table.toBuffer()], programId);

export const futurePda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.future), table.toBuffer()], programId);

export const boardPda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.board), table.toBuffer()], programId);

export const xrayPda = (table: PublicKey, programId = config.programId) =>
  find([Buffer.from(SEEDS.xray), table.toBuffer()], programId);

export const leakVaultPda = (table: PublicKey, slot: number, programId = config.programId) =>
  find([Buffer.from(SEEDS.leak), table.toBuffer(), Buffer.from([slot])], programId);

/** The accounts `tick` needs after `[table, scheduler, crank_signer]`, in the program's order. */
export const tickAccountList = (accounts: TableAccounts): PublicKey[] => [
  accounts.market,
  accounts.mempool,
  accounts.future,
  accounts.board,
  accounts.xray,
  accounts.tape,
  ...accounts.vaults,
  ...accounts.seats,
];
