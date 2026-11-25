import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { BorshAccountsCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import { createConfig } from "../src/config";
import { BrowserPayments, PaymentNotSubmittedError } from "../../app/src/lib/payments";
import {
  balances,
  checkCupStatus,
  claimHumanSeatOnConnection,
  humanSeats,
  payCup,
  submitCupJoin,
  withCupLock,
  type CupProgress,
  type ProgressStore,
} from "../../app/src/lib/cup-join";
import { verifyJoin } from "../../bots/src/cup/logic";
import type { CupStatus } from "../../app/src/lib/cup";
import { createFixture } from "../../app/src/lib/fixture";
import idl from "../../programs/idl/insider.json";

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const key = Keypair.generate();
  const authority = Keypair.generate();
  const mint = Keypair.generate().publicKey;
  const config = createConfig({ tableAuthority: authority.publicKey });
  const status: CupStatus = {
    cupId: 4,
    open: true,
    credits: 0,
    buyIn: "10000000",
    feeBps: 500,
    mint: mint.toBase58(),
    operator: authority.publicKey.toBase58(),
    history: [],
  };
  const wallet = {
    publicKey: key.publicKey,
    signMessage: vi.fn(async (message: Uint8Array) => nacl.sign.detached(message, key.secretKey)),
    signTransaction: vi.fn(async (transaction: Transaction) => {
      transaction.partialSign(key);
      return transaction;
    }),
    signVersionedTransaction: vi.fn(async (transaction: VersionedTransaction) => {
      transaction.sign([key]);
      return transaction;
    }),
  };
  let current: CupProgress | null = null;
  const writes: CupProgress[] = [];
  const store: ProgressStore = {
    read: () => current,
    write: (value) => {
      current = value;
      writes.push(value);
    },
  };
  return { key, authority, mint, config, status, wallet, store, writes };
}

describe("private cup buy-in", () => {
  it("reads only human seats and base balances, including a missing token account", async () => {
    const s = setup();
    const fixture = createFixture();
    fixture.snapshot.seats[7]!.owner = s.key.publicKey;
    fixture.snapshot.seats[8]!.owner = PublicKey.default;
    fixture.snapshot.seats[9]!.owner = Keypair.generate().publicKey;
    const coder = new BorshAccountsCoder(convertIdlToCamelCase(idl as Idl));
    const infos = await Promise.all(
      fixture.snapshot.seats.slice(7, 10).map(async (seat) => ({
        data: await coder.encode("seat", seat),
        owner: s.config.programId,
        lamports: 1,
        executable: false,
        rentEpoch: 0,
      })),
    );
    const rpc = {
      getMultipleAccountsInfo: vi.fn(async () => infos),
      getBalance: vi.fn(async () => 11_000_000),
      getAccountInfo: vi.fn(async () => null),
      getTokenAccountBalance: vi.fn(),
    };
    expect(await humanSeats(rpc as unknown as Connection, s.config, s.key.publicKey)).toEqual({
      mine: 7,
      free: 8,
    });
    expect(await balances(rpc as unknown as Connection, s.key.publicKey, s.mint)).toEqual({
      lamports: 11_000_000,
      token: 0n,
    });
    expect(rpc.getTokenAccountBalance).not.toHaveBeenCalled();
    fixture.snapshot.seats[7]!.owner = PublicKey.default;
    infos[0]!.data = await coder.encode("seat", fixture.snapshot.seats[7]!);
    const claimRpc = {
      ...rpc,
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: PublicKey.default.toBase58(),
        lastValidBlockHeight: 99,
      })),
      sendRawTransaction: vi.fn(async (_data: Buffer | Uint8Array) => "claim-sig"),
      confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
    };
    expect(
      await claimHumanSeatOnConnection(s.config, s.wallet, claimRpc as unknown as Connection),
    ).toBe(7);
    const sent = Transaction.from(claimRpc.sendRawTransaction.mock.calls[0]![0] as Buffer);
    expect(sent.feePayer?.equals(s.key.publicKey)).toBe(true);
    expect(s.wallet.signTransaction).toHaveBeenCalledOnce();
  });

  it("deposits, waits, transfers once, then waits for an operator credit", async () => {
    const s = setup();
    const payments = {
      privateBalance: vi.fn().mockResolvedValueOnce(0n).mockResolvedValue(10_000_000n),
      deposit: vi.fn(async () => "deposit-sig"),
      transfer: vi.fn(async () => "transfer-sig"),
    };
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(s.status)
      .mockResolvedValue({ ...s.status, credits: 1 });
    const progress = await payCup({ ...s, payments, getStatus, pause: async () => {} });
    expect(payments.deposit).toHaveBeenCalledWith(s.mint, 10_000_000n);
    expect(payments.transfer).toHaveBeenCalledWith(s.authority.publicKey, s.mint, 10_000_000n);
    expect(s.writes.map((value) => value.stage)).toEqual([
      "deposit_pending",
      "deposited",
      "transfer_pending",
      "paid",
    ]);
    expect(progress.transferSignature).toBe("transfer-sig");
    await payCup({
      ...s,
      payments,
      getStatus: async () => ({ ...s.status, credits: 1 }),
      pause: async () => {},
    });
    expect(payments.transfer).toHaveBeenCalledTimes(1);
    expect(payments.deposit).toHaveBeenCalledTimes(1);
  });

  it("never repeats an uncertain payment and rejects changed cup details", async () => {
    const s = setup();
    const payments = {
      privateBalance: vi.fn(async () => 10_000_000n),
      deposit: vi.fn(async () => "deposit"),
      transfer: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    };
    await expect(
      payCup({ ...s, payments, getStatus: async () => s.status, pause: async () => {} }),
    ).rejects.toThrow("connection lost");
    expect(s.store.read()?.stage).toBe("transfer_pending");
    await expect(
      payCup({ ...s, payments, getStatus: async () => s.status, pause: async () => {} }),
    ).rejects.toThrow("unknown result");
    expect(payments.transfer).toHaveBeenCalledTimes(1);
    expect(() =>
      checkCupStatus({ ...s.status, operator: Keypair.generate().publicKey.toBase58() }, s.config),
    ).toThrow("table authority");
  });

  it("allows a rejected signature to be retried without repeating a completed deposit", async () => {
    const s = setup();
    const payments = {
      privateBalance: vi.fn().mockResolvedValueOnce(0n).mockResolvedValue(10_000_000n),
      deposit: vi.fn(async () => "deposit-sig"),
      transfer: vi
        .fn()
        .mockRejectedValueOnce(new PaymentNotSubmittedError("wallet rejected"))
        .mockResolvedValue("transfer-sig"),
    };
    await expect(
      payCup({ ...s, payments, getStatus: async () => s.status, pause: async () => {} }),
    ).rejects.toThrow("wallet rejected");
    expect(s.store.read()?.stage).toBe("deposited");
    expect(s.store.read()?.depositSignature).toBe("deposit-sig");
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(s.status)
      .mockResolvedValue({ ...s.status, credits: 1 });
    await payCup({ ...s, payments, getStatus, pause: async () => {} });
    expect(payments.deposit).toHaveBeenCalledOnce();
    expect(payments.transfer).toHaveBeenCalledTimes(2);
  });

  it("allows a rejected deposit signature to be retried", async () => {
    const s = setup();
    const payments = {
      privateBalance: vi
        .fn()
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(0n)
        .mockResolvedValue(10_000_000n),
      deposit: vi
        .fn()
        .mockRejectedValueOnce(new PaymentNotSubmittedError("wallet rejected"))
        .mockResolvedValue("deposit-sig"),
      transfer: vi.fn(async () => "transfer-sig"),
    };
    await expect(
      payCup({ ...s, payments, getStatus: async () => s.status, pause: async () => {} }),
    ).rejects.toThrow("wallet rejected");
    expect(s.store.read()?.stage).toBe("ready");
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(s.status)
      .mockResolvedValue({ ...s.status, credits: 1 });
    await payCup({ ...s, payments, getStatus, pause: async () => {} });
    expect(payments.deposit).toHaveBeenCalledTimes(2);
    expect(payments.transfer).toHaveBeenCalledOnce();
  });

  it("prevents two tabs from submitting payments for the same wallet and cup", async () => {
    let held = false;
    const request = vi.fn(
      async (_name: string, _options: object, run: (lock: object | null) => Promise<unknown>) => {
        if (held) return run(null);
        held = true;
        try {
          return await run({});
        } finally {
          held = false;
        }
      },
    );
    vi.stubGlobal("navigator", { locks: { request } });
    let finish!: () => void;
    const first = withCupLock(
      "wallet",
      4,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await expect(withCupLock("wallet", 4, async () => {})).rejects.toThrow("another tab");
    finish();
    await first;
    expect(await withCupLock("wallet", 4, async () => 42)).toBe(42);
    expect(request.mock.calls[0]?.[0]).toBe("insider:cup:wallet:4");
  });

  it("partially signs a human cup join the operator accepts", async () => {
    const s = setup();
    s.store.write({
      owner: s.key.publicKey.toBase58(),
      cupId: 4,
      mint: s.status.mint,
      operator: s.status.operator,
      buyIn: s.status.buyIn,
      stage: "paid",
      creditsBefore: 0,
    });
    const connection = {
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: PublicKey.default.toBase58(),
        lastValidBlockHeight: 42,
      })),
    };
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const { transactionBase64 } = JSON.parse(String(options.body));
      expect(verifyJoin(transactionBase64, s.config, s.authority.publicKey)).toEqual({
        ok: true,
        owner: s.key.publicKey,
        seat: 8,
      });
      return new Response(JSON.stringify({ signature: "join-sig" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await submitCupJoin(
        s.config,
        s.wallet,
        8,
        "https://operator.test",
        connection as unknown as Connection,
        s.store,
      ),
    ).toBe("join-sig");
    expect(s.store.read()?.stage).toBe("joined");
    expect(s.wallet.signTransaction).toHaveBeenCalledOnce();
  });
});

describe("browser Payments client", () => {
  it("uses wallet challenge signatures, signs a base deposit and a private transfer", async () => {
    const s = setup();
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: s.key.publicKey,
        recentBlockhash: PublicKey.default.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: s.key.publicKey,
            toPubkey: s.authority.publicKey,
            lamports: 1,
          }),
        ],
      }).compileToV0Message(),
    );
    const built = {
      transactionBase64: Buffer.from(tx.serialize()).toString("base64"),
      recentBlockhash: PublicKey.default.toBase58(),
      lastValidBlockHeight: 99,
      requiredSigners: [s.key.publicKey.toBase58()],
    };
    const base = {
      sendRawTransaction: vi.fn(async () => "base-sig"),
      confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
    };
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init: RequestInit) => {
        const path = new URL(input).pathname;
        requests.push(path);
        let result: object = {};
        if (path.endsWith("/challenge")) result = { challenge: "wallet challenge" };
        if (path.endsWith("/login")) {
          const body = JSON.parse(String(init.body));
          expect(
            nacl.sign.detached.verify(
              new TextEncoder().encode("wallet challenge"),
              bs58.decode(body.signature),
              s.key.publicKey.toBytes(),
            ),
          ).toBe(true);
          result = { token: "mock-token" };
        }
        if (path.endsWith("/private-balance")) result = { balance: "10000000" };
        if (path.endsWith("/deposit")) result = { ...built, sendTo: "base" };
        if (path.endsWith("/transfer")) {
          expect((init.headers as Record<string, string>).authorization).toBe("Bearer mock-token");
          result = { ...built, sendTo: "ephemeral" };
        }
        if (path.endsWith("/transaction/send")) result = { signature: "private-sig" };
        return new Response(JSON.stringify(result), { status: 200 });
      }),
    );
    const client = new BrowserPayments(base as unknown as Connection, s.wallet);
    expect(await client.privateBalance(s.mint)).toBe(10_000_000n);
    expect(await client.deposit(s.mint, 10_000_000n)).toBe("base-sig");
    expect(await client.transfer(s.authority.publicKey, s.mint, 10_000_000n)).toBe("private-sig");
    expect(s.wallet.signMessage).toHaveBeenCalledOnce();
    expect(s.wallet.signVersionedTransaction).toHaveBeenCalledTimes(2);
    expect(base.sendRawTransaction).toHaveBeenCalledOnce();
    expect(base.confirmTransaction).toHaveBeenCalledOnce();
    expect(requests).toContain("/v1/transaction/send");
  });

  it("marks a wallet rejection as not submitted, but not a failed send", async () => {
    const s = setup();
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: s.key.publicKey,
        recentBlockhash: PublicKey.default.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: s.key.publicKey,
            toPubkey: s.authority.publicKey,
            lamports: 1,
          }),
        ],
      }).compileToV0Message(),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              transactionBase64: Buffer.from(tx.serialize()).toString("base64"),
              sendTo: "base",
              recentBlockhash: PublicKey.default.toBase58(),
              lastValidBlockHeight: 99,
              requiredSigners: [s.key.publicKey.toBase58()],
            }),
            { status: 200 },
          ),
      ),
    );
    const base = {
      sendRawTransaction: vi.fn(async () => {
        throw new Error("RPC timeout");
      }),
    };
    s.wallet.signVersionedTransaction.mockRejectedValueOnce(new Error("wallet rejected"));
    const client = new BrowserPayments(base as unknown as Connection, s.wallet);
    await expect(client.deposit(s.mint, 10_000_000n)).rejects.toBeInstanceOf(
      PaymentNotSubmittedError,
    );
    expect(base.sendRawTransaction).not.toHaveBeenCalled();
    await expect(client.deposit(s.mint, 10_000_000n)).rejects.not.toBeInstanceOf(
      PaymentNotSubmittedError,
    );
    expect(base.sendRawTransaction).toHaveBeenCalledOnce();
  });
});
