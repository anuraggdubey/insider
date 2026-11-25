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
  sessionSends: [] as Array<{ transaction: Transaction; signers: Keypair[] }>,
  sendSession: vi.fn(async (_connection: unknown, transaction: Transaction, signers: Keypair[]) => {
    mock.sessionSends.push({ transaction, signers });
    return { signature: "mock-session-signature", ms: 1 };
  }),
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
    sendTx: mock.sendSession,
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
import { sessionTokenPda } from "../src/pdas";
import { buyDeskLicense, mintDeskCall, tradeDesk } from "../../app/src/lib/desk-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mock.endpoints.length = 0;
  mock.sessionSends.length = 0;
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
    session: null,
    sessionStatus: "off",
    sessionError: null,
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

  it("routes session-capable Floor and Desk writes through the key while private reads use the wallet", async () => {
    const owner = Keypair.generate(),
      signer = Keypair.generate();
    const wallet = {
      publicKey: owner.publicKey,
      signMessage: vi.fn(async () => new Uint8Array(64)),
      signTransaction: vi.fn(async (transaction: Transaction) => {
        transaction.partialSign(owner);
        return transaction;
      }),
    };
    const config = createConfig({
      tableAuthority: Keypair.generate().publicKey,
      teeRpcUrl: "https://session-action-test.example",
    });
    const snapshot = createFixture().snapshot;
    const vault = decodeLeakVault(Buffer.from(vectors.raw.leakVault, "base64"));
    snapshot.table.roundId = vault.roundId;
    snapshot.board.headers[0]!.leakId = vault.leakId;
    snapshot.seats[7]!.owner = owner.publicKey;
    updateFloor({ snapshot, status: "live" });
    selectWallet(wallet);
    const token = sessionTokenPda(owner.publicKey, signer.publicKey, config.programId);
    updateFloor({
      session: {
        wallet: owner.publicKey,
        signer,
        token,
        validUntil: Math.floor(Date.now() / 1000) + 3600,
      },
      sessionStatus: "on",
    });

    await keepSeatAlive(config);
    await submitOrder(config, 100, 0);
    await actOnLeak(config, "bid", 0);
    snapshot.board.headers[0]!.ownerSeat = 7;
    await actOnLeak(config, "open", 0);
    await actOnLeak(config, "list", 0, 10);
    await actOnLeak(config, "offer", 0, 10);
    snapshot.board.headers[0]!.ownerSeat = 1;
    await actOnLeak(config, "buy", 0);
    await actOnLeak(config, "license", 0);
    await mintDeskCall(config, 7, { direction: 1, horizon: 60, stake: 10, licenseAsk: 5 });
    await buyDeskLicense(config, 7, 1);
    await tradeDesk(config, 7, 1);
    expect(mock.sessionSends).toHaveLength(11);
    for (const { transaction, signers } of mock.sessionSends) {
      expect(signers[0]).toBe(signer);
      expect(transaction.instructions[0]!.keys[0]!.pubkey.equals(signer.publicKey)).toBe(true);
      expect(transaction.instructions[0]!.keys.some((key) => key.pubkey.equals(token))).toBe(true);
    }
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(wallet.signMessage).toHaveBeenCalledTimes(1);
    expect(mock.auth.mock.calls.map((call) => call[1].toBase58())).toEqual([
      signer.publicKey.toBase58(),
      owner.publicKey.toBase58(),
    ]);
    expect(mock.connection.getAccountInfo).toHaveBeenCalledTimes(2);

    mock.sendSession.mockRejectedValueOnce(new Error("InvalidToken"));
    await expect(submitOrder(config, 100, 0)).rejects.toThrow("Fast mode expired");
    expect(useFloorStore.getState().session).toBeNull();
    expect(useFloorStore.getState().sessionStatus).toBe("expired");
  });
});
