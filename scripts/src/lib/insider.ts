/**
 * Client helpers for the game program: PDA derivation, the constants that mirror
 * `programs/insider/src/constants.rs`, and a typed Anchor program. This moves into `sdk/` when
 * Misbah creates it (task B-SDK-1); until then the setup script and the bots import it from here.
 */
import { AnchorProvider, Program, Wallet, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import idl from "../../../programs/idl/insider.json" with { type: "json" };
import { config } from "./config.js";

// Mirrors of the Rust constants. `scripts/test/insider.test.ts` checks they have not drifted.
export const SEEDS = {
  callBook: "callbook",
  season: "season",
  seat: "seat",
  table: "table",
  tape: "tape",
} as const;
export const SEAT_COUNT = 10;
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
  seats: PublicKey[];
};

export function tableAccounts(authority: PublicKey, programId = config.programId): TableAccounts {
  const table = tablePda(authority, programId);
  return {
    table,
    tape: tapePda(table, programId),
    callBook: callBookPda(table, programId),
    season: seasonPda(table, programId),
    seats: Array.from({ length: SEAT_COUNT }, (_, i) => seatPda(table, i, programId)),
  };
}
