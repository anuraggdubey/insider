import {
  BorshAccountsCoder,
  convertIdlToCamelCase,
  type Idl,
  type IdlAccounts,
} from "@anchor-lang/core";
import { type AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import idl from "../../programs/idl/insider.json" with { type: "json" };
import type { InsiderConfig } from "./config";
import type { Insider } from "./idl";
import { tableAccounts } from "./pdas";

export type Accounts = IdlAccounts<Insider>;
export type TableAccount = Accounts["table"];
export type SeatAccount = Accounts["seat"];
export type TapeAccount = Accounts["tape"];
export type MarketAccount = Accounts["market"];
export type BoardAccount = Accounts["board"];
export type LeakVaultAccount = Accounts["leakVault"];
export type XrayAccount = Accounts["xray"];
export type MempoolAccount = Accounts["mempool"];
export type SeasonAccount = Accounts["season"];
export type CallBookAccount = Accounts["callBook"];
export type CallVaultAccount = Accounts["callVault"];
export type CupAccount = Accounts["cup"];
export type FutureAccount = {
  roundId: number;
  shockCount: number;
  bump: number;
  shocks: { tick: number; bps: number; len: number }[];
  path: number[];
};

const coder = new BorshAccountsCoder(convertIdlToCamelCase(idl as Idl));
export function decodeAccount<K extends keyof Accounts>(name: K, data: Buffer): Accounts[K] {
  return coder.decode(name, data) as Accounts[K];
}

export const decodeTable = (data: Buffer) => decodeAccount("table", data);
export const decodeSeat = (data: Buffer) => decodeAccount("seat", data);
export const decodeTape = (data: Buffer) => decodeAccount("tape", data);
export const decodeMarket = (data: Buffer) => decodeAccount("market", data);
export const decodeMempool = (data: Buffer) => decodeAccount("mempool", data);
export const decodeBoard = (data: Buffer) => decodeAccount("board", data);
export const decodeLeakVault = (data: Buffer) => decodeAccount("leakVault", data);
export const decodeXray = (data: Buffer) => decodeAccount("xray", data);
export const decodeSeason = (data: Buffer) => decodeAccount("season", data);
export const decodeCallBook = (data: Buffer) => decodeAccount("callBook", data);
export const decodeCallVault = (data: Buffer) => decodeAccount("callVault", data);
export const decodeCup = (data: Buffer) => decodeAccount("cup", data);

export function decodeFuture(data: Buffer): FutureAccount {
  const discriminator = [245, 58, 174, 171, 44, 10, 224, 48];
  if (data.length !== 816 || !discriminator.every((byte, index) => data[index] === byte))
    throw new Error("Invalid Future account");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    roundId: view.getUint32(8, true),
    shockCount: view.getUint8(12),
    bump: view.getUint8(13),
    shocks: Array.from({ length: 4 }, (_, i) => ({
      tick: view.getUint16(16 + i * 8, true),
      bps: view.getInt16(18 + i * 8, true),
      len: view.getUint8(20 + i * 8),
    })),
    path: Array.from({ length: 192 }, (_, i) => view.getUint32(48 + i * 4, true)),
  };
}

export type TableSnapshot = {
  table: TableAccount;
  market: MarketAccount;
  desk: MarketAccount | null;
  board: BoardAccount;
  seats: SeatAccount[];
  tape: TapeAccount;
  xray: XrayAccount | null;
  season: SeasonAccount | null;
  callBook: CallBookAccount | null;
};

export function publicAddresses(config: InsiderConfig): PublicKey[] {
  if (!config.tableAuthority) throw new Error("Table authority is not configured");
  const p = tableAccounts(config.tableAuthority, config.programId);
  return [p.table, p.floor, p.desk, p.board, p.tape, ...p.seats, p.xray, p.season, p.callBook];
}

function decodeSnapshot(infos: (AccountInfo<Buffer> | null)[]): TableSnapshot | null {
  if ([0, 1, 3, 4, ...Array.from({ length: 10 }, (_, i) => i + 5)].some((index) => !infos[index]))
    return null;
  const data = (index: number) => infos[index]!.data;
  return {
    table: decodeAccount("table", data(0)),
    market: decodeAccount("market", data(1)),
    desk: infos[2] ? decodeAccount("market", data(2)) : null,
    board: decodeAccount("board", data(3)),
    tape: decodeAccount("tape", data(4)),
    seats: Array.from({ length: 10 }, (_, i) => decodeAccount("seat", data(i + 5))),
    xray: infos[15] ? decodeAccount("xray", data(15)) : null,
    season: infos[16] ? decodeAccount("season", data(16)) : null,
    callBook: infos[17] ? decodeAccount("callBook", data(17)) : null,
  };
}

export async function fetchTable(
  connection: Connection,
  config: InsiderConfig,
): Promise<TableSnapshot | null> {
  return decodeSnapshot(
    await connection.getMultipleAccountsInfo(publicAddresses(config), "confirmed"),
  );
}

export function subscribeTable(
  connection: Connection,
  config: InsiderConfig,
  onChange: (snapshot: TableSnapshot | null) => void,
  onError?: (error: unknown) => void,
): () => void {
  let closed = false;
  let running = false;
  let dirty = false;
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    timer = undefined;
    if (closed || running) return;
    running = true;
    dirty = false;
    try {
      const snapshot = await fetchTable(connection, config);
      if (!closed) {
        last = Date.now();
        onChange(snapshot);
      }
    } catch (error) {
      if (!closed) onError?.(error);
    } finally {
      running = false;
      if (dirty && !closed) schedule();
    }
  };
  const schedule = () => {
    dirty = true;
    if (!timer && !running && !closed)
      timer = setTimeout(refresh, Math.max(0, 500 - (Date.now() - last)));
  };
  const subscriptions = publicAddresses(config).map((address) =>
    connection.onAccountChange(address, schedule, "confirmed"),
  );
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    for (const id of subscriptions) void connection.removeAccountChangeListener(id).catch(() => {});
  };
}
