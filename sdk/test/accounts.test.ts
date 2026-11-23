import { BN, BorshAccountsCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import { type AccountInfo, type Connection, Keypair, PublicKey } from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConfig,
  fetchTable,
  publicAddresses,
  subscribeTable,
  tableAccounts,
} from "../src/index.js";
import idl from "../../programs/idl/insider.json";
import vectors from "./fixtures/vectors.json";

const coder = new BorshAccountsCoder(convertIdlToCamelCase(idl as Idl));
const config = createConfig({ tableAuthority: Keypair.generate().publicKey });
const owner = Keypair.generate().publicKey;
const bn = (value: number) => new BN(value);
const info = (data: Buffer): AccountInfo<Buffer> => ({
  data,
  owner: config.programId,
  lamports: 1,
  executable: false,
  rentEpoch: 0,
});

async function accounts() {
  const table = await coder.encode("table", {
    authority: config.tableAuthority,
    epoch: 0,
    roundId: 7,
    phase: { live: {} },
    roundStartSlot: bn(100),
    tick: 10,
    armedUntilSlot: bn(0),
    vrfNonce: 0,
    vrfPending: false,
    vrfRequestedTick: 0,
    roundsThisEpoch: 0,
    bump: 0,
    params: {
      arbBps: 400,
      feeBps: 10,
      priorityFee: 10,
      standardDelay: 20,
      priorityDelay: 4,
      maxOrderUnits: 2000,
      maxPositionUnits: 5000,
      maxPending: 4,
      vammBase: bn(50000),
      vammQuote: bn(50000),
    },
  });
  const seat = await coder.encode("seat", {
    index: 0,
    owner,
    nameIdx: 1,
    kind: { bot: {} },
    chips: bn(1000),
    position: 0,
    entry: bn(0),
    feesPaid: bn(0),
    leakSpend: bn(0),
    pendingCount: 0,
    deskChips: bn(0),
    deskPosition: 0,
    lastSeenTick: 0,
    claims: 0,
    bump: 0,
  });
  const tape = await coder.encode("tape", {
    sends: Array.from({ length: 64 }, () => ({ seat: 0, lane: 0, sentTick: 0 })),
    sendsHead: 0,
    fills: Array.from({ length: 64 }, () => ({
      seat: 0,
      side: 0,
      size: 0,
      price: 0,
      landedTick: 0,
    })),
    fillsHead: 0,
    bump: 0,
  });
  return [
    info(table),
    info(Buffer.from(vectors.raw.market, "base64")),
    null,
    info(Buffer.from(vectors.raw.board, "base64")),
    info(tape),
    ...Array.from({ length: 10 }, () => info(seat)),
    info(Buffer.from(vectors.raw.xray, "base64")),
    null,
    null,
  ];
}

afterEach(() => vi.useRealTimers());

describe("public table fetching", () => {
  it("fetches every public account in one RPC call, never private accounts", async () => {
    const data = await accounts();
    const rpc = {
      getMultipleAccountsInfo: vi.fn().mockResolvedValue(data),
    } as unknown as Connection;
    const snapshot = await fetchTable(rpc, config);
    expect(snapshot?.table.roundId).toBe(7);
    expect(snapshot?.market.base.toString()).toBe(vectors.expected.market.base);
    expect(snapshot?.seats).toHaveLength(10);
    expect(snapshot?.xray?.finalized).toBe(1);
    expect(snapshot?.desk).toBeNull();
    expect(rpc.getMultipleAccountsInfo).toHaveBeenCalledTimes(1);
    const addresses = publicAddresses(config);
    const p = tableAccounts(config.tableAuthority!, config.programId);
    expect(addresses).toHaveLength(18);
    expect(addresses.some((address) => address.equals(p.desk))).toBe(true);
    for (const privateAddress of [p.mempool, p.future, ...p.leakVaults])
      expect(addresses.some((address) => address.equals(privateAddress))).toBe(false);
    expect(rpc.getMultipleAccountsInfo).toHaveBeenCalledWith(addresses, "confirmed");
    data[3] = null;
    expect(await fetchTable(rpc, config)).toBeNull();
  });

  it("coalesces all public account notifications to at most two snapshots per second and unsubscribes", async () => {
    const data = await accounts();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const listeners: (() => void)[] = [];
    const rpc = {
      getMultipleAccountsInfo: vi.fn().mockResolvedValue(data),
      onAccountChange: vi.fn((_address: PublicKey, callback: () => void) => {
        listeners.push(callback);
        return listeners.length;
      }),
      removeAccountChangeListener: vi.fn().mockResolvedValue(undefined),
    } as unknown as Connection;
    const change = vi.fn();
    const unsubscribe = subscribeTable(rpc, config, change);
    expect(listeners).toHaveLength(18);
    for (const listener of listeners) listener();
    await vi.advanceTimersByTimeAsync(0);
    expect(change).toHaveBeenCalledTimes(1);
    listeners[0]!();
    listeners[1]!();
    await vi.advanceTimersByTimeAsync(499);
    expect(change).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(change).toHaveBeenCalledTimes(2);
    listeners[0]!();
    unsubscribe();
    await vi.advanceTimersByTimeAsync(1000);
    expect(change).toHaveBeenCalledTimes(2);
    expect(rpc.removeAccountChangeListener).toHaveBeenCalledTimes(18);
  });

  it("does not emit two callbacks close together after a slow RPC response", async () => {
    const data = await accounts();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const listeners: (() => void)[] = [];
    const rpc = {
      getMultipleAccountsInfo: vi
        .fn()
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(() => resolve(data), 600)),
        )
        .mockResolvedValue(data),
      onAccountChange: vi.fn((_address: PublicKey, callback: () => void) => {
        listeners.push(callback);
        return listeners.length;
      }),
      removeAccountChangeListener: vi.fn().mockResolvedValue(undefined),
    } as unknown as Connection;
    const change = vi.fn();
    const unsubscribe = subscribeTable(rpc, config, change);
    listeners[0]!();
    await vi.advanceTimersByTimeAsync(100);
    listeners[1]!();
    await vi.advanceTimersByTimeAsync(500);
    expect(change).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(change).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(change).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
