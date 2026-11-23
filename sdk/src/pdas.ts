import { PublicKey } from "@solana/web3.js";
import { createConfig } from "#config";
import { LEAK_SLOTS, MARKET_DESK, MARKET_FLOOR, SEAT_COUNT, SEEDS } from "#constants";

const bytes = (seed: string) => new TextEncoder().encode(seed);
const oneByte = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 255)
    throw new RangeError("PDA index must be a byte");
  return Uint8Array.of(value);
};
const find = (seeds: Uint8Array[], programId = createConfig().programId) =>
  PublicKey.findProgramAddressSync(seeds, programId)[0];

export const tablePda = (authority: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.table), authority.toBytes()], programId);
export const tapePda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.tape), table.toBytes()], programId);
export const callBookPda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.callBook), table.toBytes()], programId);
export const seasonPda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.season), table.toBytes()], programId);
export const seatPda = (table: PublicKey, index: number, programId?: PublicKey) =>
  find([bytes(SEEDS.seat), table.toBytes(), oneByte(index)], programId);
export const marketPda = (table: PublicKey, kind: number, programId?: PublicKey) =>
  find([bytes(SEEDS.market), table.toBytes(), oneByte(kind)], programId);
export const mempoolPda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.mempool), table.toBytes()], programId);
export const futurePda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.future), table.toBytes()], programId);
export const boardPda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.board), table.toBytes()], programId);
export const leakVaultPda = (table: PublicKey, slot: number, programId?: PublicKey) =>
  find([bytes(SEEDS.leak), table.toBytes(), oneByte(slot)], programId);
export const xrayPda = (table: PublicKey, programId?: PublicKey) =>
  find([bytes(SEEDS.xray), table.toBytes()], programId);
export const callVaultPda = (table: PublicKey, slot: number, programId?: PublicKey) =>
  find([bytes(SEEDS.callVault), table.toBytes(), oneByte(slot)], programId);
export const nobodyPda = (programId?: PublicKey) => find([bytes(SEEDS.nobody)], programId);

export function tableAccounts(authority: PublicKey, programId?: PublicKey) {
  const table = tablePda(authority, programId);
  return {
    table,
    tape: tapePda(table, programId),
    callBook: callBookPda(table, programId),
    season: seasonPda(table, programId),
    seats: Array.from({ length: SEAT_COUNT }, (_, i) => seatPda(table, i, programId)),
    floor: marketPda(table, MARKET_FLOOR, programId),
    desk: marketPda(table, MARKET_DESK, programId),
    mempool: mempoolPda(table, programId),
    future: futurePda(table, programId),
    board: boardPda(table, programId),
    leakVaults: Array.from({ length: LEAK_SLOTS }, (_, i) => leakVaultPda(table, i, programId)),
    xray: xrayPda(table, programId),
    callVaults: Array.from({ length: SEAT_COUNT }, (_, i) => callVaultPda(table, i, programId)),
    nobody: nobodyPda(programId),
  };
}
export type TableAccounts = ReturnType<typeof tableAccounts>;
