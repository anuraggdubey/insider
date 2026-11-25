import { Keypair, Transaction, type Connection } from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../src/config";
import { sessionTokenPda } from "../src/pdas";
import {
  clearSession,
  disableSession,
  enableSession,
  restoreSession,
  saveSession,
  sessionStorageKey,
} from "../../app/src/lib/session";
import { actionActor, type SessionAction } from "../../app/src/lib/session-routing";
import type { FastSession } from "../../app/src/lib/floor-store";

function setup() {
  const owner = Keypair.generate(),
    signer = Keypair.generate();
  const config = createConfig({ tableAuthority: Keypair.generate().publicKey });
  const wallet = {
    publicKey: owner.publicKey,
    signMessage: vi.fn(async () => new Uint8Array(64)),
    signTransaction: vi.fn(async (transaction: Transaction) => {
      transaction.partialSign(owner);
      return transaction;
    }),
  };
  const session: FastSession = {
    wallet: owner.publicKey,
    signer,
    token: sessionTokenPda(owner.publicKey, signer.publicKey, config.programId),
    validUntil: Math.floor(Date.now() / 1000) + 3600,
  };
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
  const connection = {
    getAccountInfo: vi.fn(async () => ({ data: Buffer.alloc(1) })),
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 500,
    })),
    sendRawTransaction: vi.fn(async (_raw: Uint8Array) => "signature"),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
  };
  return { config, owner, wallet, session, storage, values, connection };
}

afterEach(() => vi.unstubAllGlobals());

describe("Fast mode storage and routing", () => {
  it("round-trips a session and drops expired, missing or mismatched tokens", async () => {
    const s = setup();
    saveSession(s.session, s.storage);
    const restored = await restoreSession(
      s.config,
      s.wallet,
      s.connection as unknown as Connection,
      s.storage,
    );
    expect(restored?.signer.publicKey.equals(s.session.signer.publicKey)).toBe(true);
    expect(restored?.token.equals(s.session.token)).toBe(true);
    expect(
      await restoreSession(
        s.config,
        s.wallet,
        s.connection as unknown as Connection,
        s.storage,
        s.session.validUntil * 1000 - 60_000,
      ),
    ).toBeNull();
    expect(s.values.size).toBe(0);
    saveSession(s.session, s.storage);
    s.connection.getAccountInfo.mockResolvedValueOnce(null as never);
    expect(
      await restoreSession(s.config, s.wallet, s.connection as unknown as Connection, s.storage),
    ).toBeNull();
    expect(s.values.size).toBe(0);
    saveSession({ ...s.session, token: Keypair.generate().publicKey }, s.storage);
    expect(
      await restoreSession(s.config, s.wallet, s.connection as unknown as Connection, s.storage),
    ).toBeNull();
    expect(s.values.size).toBe(0);
  });

  it("retains an uncertain submission until it can be checked", async () => {
    const s = setup();
    saveSession(s.session, s.storage, true);
    s.connection.getAccountInfo.mockResolvedValueOnce(null as never);
    await expect(
      restoreSession(s.config, s.wallet, s.connection as unknown as Connection, s.storage),
    ).rejects.toThrow("outcome is unknown");
    expect(s.storage.getItem(sessionStorageKey(s.owner.publicKey))).not.toBeNull();
    expect(
      await restoreSession(s.config, s.wallet, s.connection as unknown as Connection, s.storage),
    ).not.toBeNull();
    expect(
      JSON.parse(s.storage.getItem(sessionStorageKey(s.owner.publicKey))!).pending,
    ).toBeUndefined();
  });

  it("routes all permitted actions through the session, but never seat or cup joins", () => {
    const s = setup();
    const allowed: SessionAction[] = [
      "ping",
      "sendOrder",
      "bid",
      "openLeak",
      "listLeak",
      "buyListed",
      "offerLicense",
      "buyLicense",
      "mintCall",
      "buyCallLicense",
      "deskTrade",
    ];
    for (const action of allowed) {
      const actor = actionActor(action, s.wallet, s.session);
      expect(actor.signer).toBe(s.session.signer);
      expect(actor.token?.equals(s.session.token)).toBe(true);
    }
    for (const action of ["claimSeat", "cupJoin"] as const)
      expect(actionActor(action, s.wallet, s.session)).toEqual({ signer: s.wallet });
    expect(actionActor("ping", s.wallet, null)).toEqual({ signer: s.wallet });
    expect(actionActor("ping", s.session.signer, s.session)).toEqual({ signer: s.session.signer });
    expect(() =>
      actionActor("ping", s.wallet, s.session, s.session.validUntil * 1000 - 60_000),
    ).toThrow("Fast mode expired");
  });

  it("creates and revokes using one wallet signature per base transaction", async () => {
    const s = setup();
    const connection = s.connection as unknown as Connection;
    const created = await enableSession(s.config, s.wallet, connection, s.storage);
    expect(s.wallet.signTransaction).toHaveBeenCalledTimes(1);
    const create = Transaction.from(s.connection.sendRawTransaction.mock.calls[0]![0]);
    expect(create.feePayer?.equals(s.owner.publicKey)).toBe(true);
    expect(create.verifySignatures()).toBe(true);
    expect(
      create.signatures.some((signature) =>
        signature.publicKey.equals(created.session.signer.publicKey),
      ),
    ).toBe(true);
    expect(
      created.session.token.equals(
        sessionTokenPda(s.owner.publicKey, created.session.signer.publicKey, s.config.programId),
      ),
    ).toBe(true);
    expect(s.storage.getItem(sessionStorageKey(s.owner.publicKey))).not.toBeNull();
    await disableSession(s.config, s.wallet, created.session, connection, s.storage);
    expect(s.wallet.signTransaction).toHaveBeenCalledTimes(2);
    expect(s.storage.getItem(sessionStorageKey(s.owner.publicKey))).toBeNull();
    const revoke = Transaction.from(s.connection.sendRawTransaction.mock.calls[1]![0]);
    expect(revoke.feePayer?.equals(s.owner.publicKey)).toBe(true);
    expect(revoke.verifySignatures()).toBe(true);
    clearSession(s.owner.publicKey, s.storage);
  });

  it("leaves no pending record after a definite insufficient-funds rejection", async () => {
    const s = setup();
    s.connection.sendRawTransaction.mockRejectedValueOnce(new Error("insufficient funds"));
    await expect(
      enableSession(s.config, s.wallet, s.connection as unknown as Connection, s.storage),
    ).rejects.toThrow("insufficient funds");
    expect(s.values.size).toBe(0);
  });
});
