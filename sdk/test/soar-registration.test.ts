import { describe, expect, it, vi } from "vitest";
import { Keypair, PublicKey, SystemProgram, Transaction, type Connection } from "@solana/web3.js";
import { createConfig } from "../src/config";
import { loadSoar, registerSoar, soarRegistered, type SoarReceipt } from "../../app/src/lib/soar";

function setup({ playerExists = false, registered = false } = {}) {
  const key = Keypair.generate();
  const player = Keypair.generate().publicKey;
  const list = Keypair.generate().publicKey;
  const board = Keypair.generate().publicKey;
  let entryExists = registered;
  const receipts: SoarReceipt[] = [];
  const account = {
    data: Buffer.alloc(0),
    executable: false,
    lamports: 1,
    owner: PublicKey.default,
    rentEpoch: 0,
  };
  const connection = {
    getAccountInfo: vi.fn(async (address: PublicKey) =>
      address.equals(list)
        ? entryExists
          ? account
          : null
        : address.equals(player) && playerExists
          ? account
          : null,
    ),
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 123,
    })),
    sendRawTransaction: vi.fn(async () => {
      if (connection.sendRawTransaction.mock.calls.length === (playerExists ? 1 : 2))
        entryExists = true;
      return `signature-${connection.sendRawTransaction.mock.calls.length}`;
    }),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
  };
  const tx = () =>
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: key.publicKey, toPubkey: board, lamports: 1 }),
    );
  const client = {
    utils: {
      derivePlayerAddress: vi.fn(() => [player, 1]),
      derivePlayerScoresListAddress: vi.fn(() => [list, 1]),
    },
    initializePlayerAccount: vi.fn(async () => ({ transaction: tx(), newPlayer: player })),
    registerPlayerEntryForLeaderBoard: vi.fn(async () => ({ transaction: tx(), newList: list })),
  };
  const wallet = {
    publicKey: key.publicKey,
    signTransaction: vi.fn(async (transaction: Transaction) => {
      expect(transaction.feePayer?.equals(key.publicKey)).toBe(true);
      expect(transaction.recentBlockhash).toBeTruthy();
      transaction.sign(key);
      return transaction;
    }),
  };
  return { connection, client, wallet, key, player, list, board, receipts };
}

describe("SOAR registration", () => {
  it("initializes and registers with two wallet-signed base transactions", async () => {
    const s = setup();
    await registerSoar(
      s.connection as unknown as Connection,
      s.client as never,
      s.wallet,
      s.board,
      (r) => s.receipts.push(r),
    );
    expect(s.client.initializePlayerAccount).toHaveBeenCalledWith(
      s.key.publicKey,
      expect.stringMatching(/^insider-/),
      PublicKey.default,
    );
    expect(s.client.registerPlayerEntryForLeaderBoard).toHaveBeenCalledWith(
      s.key.publicKey,
      s.board,
    );
    expect(s.wallet.signTransaction).toHaveBeenCalledTimes(2);
    expect(s.connection.getLatestBlockhash).toHaveBeenCalledTimes(2);
    expect(s.connection.confirmTransaction).toHaveBeenCalledTimes(2);
    expect(s.receipts.map((r) => r.step)).toEqual(["player", "leaderboard"]);
    expect(
      await soarRegistered(
        s.connection as unknown as Connection,
        s.client as never,
        s.key.publicKey,
        s.board,
      ),
    ).toBe(true);
  });

  it("resumes from an existing player and does nothing when already registered", async () => {
    const s = setup({ playerExists: true });
    await registerSoar(
      s.connection as unknown as Connection,
      s.client as never,
      s.wallet,
      s.board,
      (r) => s.receipts.push(r),
    );
    expect(s.client.initializePlayerAccount).not.toHaveBeenCalled();
    expect(s.wallet.signTransaction).toHaveBeenCalledTimes(1);
    const done = setup({ registered: true });
    await registerSoar(
      done.connection as unknown as Connection,
      done.client as never,
      done.wallet,
      done.board,
      () => {},
    );
    expect(done.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("does not sign if the wallet identity changed", async () => {
    const s = setup();
    await expect(
      registerSoar(
        s.connection as unknown as Connection,
        s.client as never,
        s.wallet,
        s.board,
        () => {},
        () => false,
      ),
    ).rejects.toThrow("Wallet changed");
    expect(s.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("uses the generated SOAR leaderboard and accepts the public override", async () => {
    const wallet = Keypair.generate().publicKey;
    try {
      vi.stubEnv("NEXT_PUBLIC_SOAR_LEADERBOARD", "");
      const defaultClient = await loadSoar(createConfig(), wallet);
      expect(defaultClient.leaderboard.toBase58()).toBe(
        "HRLwsB4PeVTE8Lm2RVDoYfYtT3FCGYxH7F1A2e9rryib",
      );
      const override = Keypair.generate().publicKey;
      vi.stubEnv("NEXT_PUBLIC_SOAR_LEADERBOARD", override.toBase58());
      const customClient = await loadSoar(createConfig(), wallet);
      expect(customClient.leaderboard.equals(override)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps the first receipt and stops if the second transaction fails", async () => {
    const s = setup();
    s.connection.confirmTransaction
      .mockResolvedValueOnce({ value: { err: null } })
      .mockResolvedValueOnce({ value: { err: { InstructionError: [0, "Custom"] } } } as never);
    await expect(
      registerSoar(
        s.connection as unknown as Connection,
        s.client as never,
        s.wallet,
        s.board,
        (receipt) => s.receipts.push(receipt),
      ),
    ).rejects.toThrow("Transaction failed");
    expect(s.receipts.map((receipt) => receipt.step)).toEqual(["player"]);
  });

  it("builds real SOAR instructions for the wallet against a mocked base connection", async () => {
    const s = setup();
    const { client, leaderboard } = await loadSoar(createConfig(), s.key.publicKey);
    const game = Keypair.generate().publicKey;
    const builder = client as unknown as {
      builder: {
        accounts: { program: { account: { leaderBoard: { fetch: () => Promise<unknown> } } } };
      };
    };
    vi.spyOn(builder.builder.accounts.program.account.leaderBoard, "fetch").mockResolvedValue({
      game,
    });
    const [player] = client.utils.derivePlayerAddress(s.key.publicKey);
    const [list] = client.utils.derivePlayerScoresListAddress(s.key.publicKey, leaderboard);
    let sent = 0;
    const connection = {
      ...s.connection,
      getAccountInfo: vi.fn(async (address: PublicKey) =>
        address.equals(list) && sent >= 2 ? { owner: client.program.programId } : null,
      ),
      sendRawTransaction: vi.fn(async () => `signature-${++sent}`),
    };
    const transactions: Transaction[] = [];
    const wallet = {
      publicKey: s.key.publicKey,
      signTransaction: vi.fn(async (transaction: Transaction) => {
        transactions.push(transaction);
        transaction.sign(s.key);
        return transaction;
      }),
    };
    await registerSoar(connection as unknown as Connection, client, wallet, leaderboard, (r) =>
      s.receipts.push(r),
    );
    expect(transactions).toHaveLength(2);
    for (const transaction of transactions) {
      expect(transaction.feePayer?.equals(s.key.publicKey)).toBe(true);
      expect(transaction.instructions[0]?.programId.equals(client.program.programId)).toBe(true);
      expect(
        transaction.instructions[0]?.keys.some(
          (key) => key.pubkey.equals(s.key.publicKey) && key.isSigner,
        ),
      ).toBe(true);
    }
    expect(transactions[0]?.instructions[0]?.keys.some((key) => key.pubkey.equals(player))).toBe(
      true,
    );
    expect(transactions[0]?.instructions[0]?.data.subarray(-32)).toEqual(
      PublicKey.default.toBuffer(),
    );
    expect(transactions[1]?.instructions[0]?.keys.some((key) => key.pubkey.equals(list))).toBe(
      true,
    );
    expect(transactions[1]?.instructions[0]?.keys.some((key) => key.pubkey.equals(game))).toBe(
      true,
    );
  });
});
