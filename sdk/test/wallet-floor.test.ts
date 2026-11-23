import { Keypair, Transaction, type PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsiderConfig, MessageSigner } from "../src/index";

const mock = vi.hoisted(() => ({
  auth: vi.fn<
    (
      url: string,
      key: PublicKey,
      sign: (message: Uint8Array) => Promise<Uint8Array>,
    ) => Promise<{ token: string; expiresAt: number }>
  >(),
  connection: {
    getLatestBlockhash: vi.fn<() => Promise<{ blockhash: string; lastValidBlockHeight: number }>>(),
    sendRawTransaction: vi.fn<(data: Buffer) => Promise<string>>(),
    confirmTransaction: vi.fn<() => Promise<{ value: { err: null } }>>(),
    getAccountInfo: vi.fn<() => Promise<{ data: Buffer }>>(),
  },
  endpoints: [] as string[],
}));
vi.mock("@magicblock-labs/ephemeral-rollups-sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@magicblock-labs/ephemeral-rollups-sdk")>()),
  getAuthToken: mock.auth,
}));
vi.mock("@insider/sdk", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("../src/index")>();
  return {
    ...sdk,
    teeConnection: vi.fn(async (config: InsiderConfig, signer: MessageSigner) => {
      const auth = await sdk.teeAuthUrl(config.teeRpcUrl, signer);
      mock.endpoints.push(auth.url);
      return mock.connection;
    }),
  };
});

import { createConfig, decodeLeakVault } from "@insider/sdk";
import {
  actOnLeak,
  joinFloor,
  keepSeatAlive,
  restoreVault,
  submitOrder,
} from "../../app/src/lib/floor-actions";
import { createFixture } from "../../app/src/lib/fixture";
import {
  selectGuest,
  selectWallet,
  syncWallet,
  updateFloor,
  useFloorStore,
} from "../../app/src/lib/floor-store";
import vectors from "./fixtures/vectors.json";

beforeEach(() => {
  vi.clearAllMocks();
  mock.endpoints.length = 0;
  mock.auth.mockImplementation(async (_url, _key, sign) => {
    await sign(new Uint8Array([3, 1, 4]));
    return { token: "mock-private-token", expiresAt: Date.now() + 60_000 };
  });
  mock.connection.getLatestBlockhash.mockResolvedValue({
    blockhash: "11111111111111111111111111111111",
    lastValidBlockHeight: 100,
  });
  mock.connection.sendRawTransaction.mockResolvedValue("mock-signature");
  mock.connection.confirmTransaction.mockResolvedValue({ value: { err: null } });
  mock.connection.getAccountInfo.mockResolvedValue({
    data: Buffer.from(vectors.raw.leakVault, "base64"),
  });
  updateFloor({
    guest: null,
    identity: "guest",
    walletKey: null,
    wallet: null,
    fixture: null,
    snapshot: null,
    pending: [],
    vaults: {},
    joinRequested: false,
  });
});

describe("wallet floor identity", () => {
  it("authenticates once with signMessage and signs claim and gameplay transactions with the wallet", async () => {
    const keypair = Keypair.generate();
    const wallet = {
      publicKey: keypair.publicKey,
      signMessage: vi.fn(async () => new Uint8Array(64).fill(2)),
      signTransaction: vi.fn(async (transaction: Transaction) => {
        expect(transaction.feePayer?.equals(keypair.publicKey)).toBe(true);
        transaction.partialSign(keypair);
        return transaction;
      }),
    };
    const config = createConfig({
      tableAuthority: Keypair.generate().publicKey,
      teeRpcUrl: "https://wallet-test.example",
    });
    const snapshot = createFixture().snapshot;
    const vault = decodeLeakVault(Buffer.from(vectors.raw.leakVault, "base64"));
    snapshot.table.roundId = vault.roundId;
    snapshot.board.headers[0]!.leakId = vault.leakId;
    updateFloor({ snapshot, status: "live" });
    selectWallet(wallet);
    await joinFloor(config);
    expect(wallet.signTransaction).toHaveBeenCalledTimes(1);
    const claim = Transaction.from(mock.connection.sendRawTransaction.mock.calls[0]![0]);
    expect(
      claim.instructions[0]!.keys.some(
        (key) => key.pubkey.equals(wallet.publicKey) && key.isSigner,
      ),
    ).toBe(true);
    snapshot.seats[7]!.owner = wallet.publicKey;
    await submitOrder(config, 100, 0);
    await actOnLeak(config, "bid", 0);
    snapshot.board.headers[0]!.ownerSeat = 7;
    await actOnLeak(config, "open", 0);
    await actOnLeak(config, "list", 0, 10);
    await actOnLeak(config, "offer", 0, 10);
    snapshot.board.headers[0]!.ownerSeat = 1;
    await actOnLeak(config, "buy", 0);
    await actOnLeak(config, "license", 0);
    expect(wallet.signTransaction).toHaveBeenCalledTimes(8);
    expect(wallet.signMessage).toHaveBeenCalledTimes(1);
    expect(mock.auth).toHaveBeenCalledTimes(1);
    expect(mock.endpoints.every((url) => url.includes("token=mock-private-token"))).toBe(true);
    expect(mock.connection.getAccountInfo).toHaveBeenCalledTimes(2);
    await keepSeatAlive(config);
    expect(wallet.signTransaction).toHaveBeenCalledTimes(8);
    expect(useFloorStore.getState().vaults[vault.leakId]).toBeDefined();
    syncWallet(null, null);
    expect(useFloorStore.getState().vaults).toEqual({});
    expect(useFloorStore.getState().pending).toEqual([]);
    await expect(submitOrder(config, 100, 0)).rejects.toThrow("Connect a wallet");
  });

  it("does not deliver an in-flight private vault to a different identity", async () => {
    const walletKey = Keypair.generate();
    const wallet = {
      publicKey: walletKey.publicKey,
      signMessage: vi.fn(async () => new Uint8Array(64)),
      signTransaction: vi.fn(async (transaction: Transaction) => transaction),
    };
    const fixture = createFixture();
    const vault = decodeLeakVault(Buffer.from(vectors.raw.leakVault, "base64"));
    fixture.snapshot.table.roundId = vault.roundId;
    updateFloor({ snapshot: fixture.snapshot, fixture: null });
    selectWallet(wallet);
    let resolve!: (value: { data: Buffer }) => void;
    mock.connection.getAccountInfo.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const config = createConfig({
      tableAuthority: Keypair.generate().publicKey,
      teeRpcUrl: "https://wallet-race.example",
    });
    const loading = restoreVault(config, 0, vault.leakId);
    await vi.waitFor(() => expect(mock.connection.getAccountInfo).toHaveBeenCalledOnce());
    selectGuest(Keypair.generate());
    resolve({ data: Buffer.from(vectors.raw.leakVault, "base64") });
    await expect(loading).rejects.toThrow("player changed");
    expect(useFloorStore.getState().vaults).toEqual({});
  });
});
