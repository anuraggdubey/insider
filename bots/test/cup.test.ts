import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { createConfig, cupJoin, deskTrade } from "@insider/sdk";

import { CreditLedger, payouts, verifyJoin } from "../src/cup/logic.js";

const BUY_IN = 10_000_000n;

describe("CreditLedger", () => {
  it("ignores what was already there, then turns each buy-in into one credit", () => {
    const ledger = new CreditLedger(BUY_IN);
    ledger.observe(55_000_000n);
    expect(ledger.credits).toBe(0);
    ledger.observe(65_000_000n);
    expect(ledger.credits).toBe(1);
    // two buy-ins land between two looks
    ledger.observe(85_000_000n);
    expect(ledger.credits).toBe(3);
  });

  it("carries a part payment until it adds up, and does not count a balance that did not move", () => {
    const ledger = new CreditLedger(BUY_IN);
    ledger.observe(0n);
    ledger.observe(4_000_000n);
    expect(ledger.credits).toBe(0);
    ledger.observe(4_000_000n);
    ledger.observe(10_000_000n);
    expect(ledger.credits).toBe(1);
  });

  it("a payout lowers the balance without costing credits, and a rebase keeps it from counting twice", () => {
    const ledger = new CreditLedger(BUY_IN);
    ledger.observe(0n);
    ledger.observe(20_000_000n);
    expect(ledger.spend()).toBe(true);
    expect(ledger.spend()).toBe(true);
    expect(ledger.spend()).toBe(false);
    // 19 tokens of prizes leave; the next reading is lower, not a credit
    ledger.observe(1_000_000n);
    ledger.observe(1_000_000n);
    expect(ledger.credits).toBe(0);
    ledger.rebase(5_000_000n);
    ledger.observe(5_000_000n);
    expect(ledger.credits).toBe(0);
  });

  it("survives a restart", () => {
    const ledger = new CreditLedger(BUY_IN);
    ledger.observe(0n);
    ledger.observe(25_000_000n);
    const restored = new CreditLedger(BUY_IN);
    restored.load(JSON.parse(JSON.stringify(ledger.save())));
    expect(restored.credits).toBe(2);
    restored.observe(35_000_000n);
    expect(restored.credits).toBe(3);
  });
});

describe("payouts", () => {
  it("takes the platform fee off the pot, then splits the pool by the program's shares", () => {
    const p = payouts(3, BUY_IN, 500, [5_000, 3_000, 2_000]);
    expect(p.pot).toBe(30_000_000n);
    expect(p.fee).toBe(1_500_000n);
    expect(p.prizes).toEqual([14_250_000n, 8_550_000n, 5_700_000n]);
    expect(p.prizes.reduce((a, b) => a + b, 0n) + p.fee).toBe(p.pot);
  });

  it("always adds up to the pot: rounding dust goes to the fee", () => {
    for (const [entrants, shares] of [
      [1, [10_000, 0, 0]],
      [2, [6_000, 4_000, 0]],
      [3, [5_000, 3_000, 2_000]],
    ] as const) {
      for (const buyIn of [1n, 7n, 3_333_333n, 10_000_000n]) {
        const p = payouts(entrants, buyIn, 500, [...shares]);
        expect(p.prizes.reduce((a, b) => a + b, 0n) + p.fee).toBe(p.pot);
        expect(p.prizes.every((x) => x >= 0n)).toBe(true);
      }
    }
    expect(payouts(2, BUY_IN, 500, [6_000, 4_000, 0]).prizes).toEqual([
      11_400_000n,
      7_600_000n,
      0n,
    ]);
  });

  it("pays nothing for an empty cup", () => {
    expect(payouts(0, BUY_IN, 500, [0, 0, 0])).toEqual({ prizes: [0n, 0n, 0n], fee: 0n, pot: 0n });
  });
});

describe("verifyJoin", () => {
  const operator = Keypair.generate();
  const config = createConfig({ tableAuthority: operator.publicKey });
  const owner = Keypair.generate();

  const signed = (
    build: (owner: PublicKey) => ReturnType<typeof cupJoin>,
    signer: Keypair = owner,
  ) => {
    const transaction = new Transaction().add(build(owner.publicKey));
    transaction.feePayer = signer.publicKey;
    transaction.recentBlockhash = PublicKey.default.toBase58();
    transaction.partialSign(signer);
    return transaction.serialize({ requireAllSignatures: false }).toString("base64");
  };

  it("accepts the owner's signed cup_join for a seat and names the seat and the owner", () => {
    const result = verifyJoin(
      signed((key) => cupJoin(config, key, 8)),
      config,
      operator.publicKey,
    );
    expect(result).toEqual({ ok: true, owner: owner.publicKey, seat: 8 });
  });

  it("refuses anything that is not exactly that", () => {
    const reason = (text: string, c = config) => {
      const result = verifyJoin(text, c, operator.publicKey);
      return result.ok ? "accepted" : result.reason;
    };
    expect(reason("not base64 !!")).toBe("not a transaction");
    // another instruction of ours
    expect(reason(signed((key) => deskTrade(config, key, 8, 10)))).toBe("not a cup_join");
    // not signed by the seat owner
    const stranger = Keypair.generate();
    expect(reason(signed((key) => cupJoin(config, key, 8), stranger))).toBe(
      "the seat owner has not signed",
    );
    // a different operator or program is not ours to co-sign
    const other = createConfig({ tableAuthority: Keypair.generate().publicKey });
    expect(reason(signed((key) => cupJoin(other, key, 8)))).toBe("not a cup_join for this table");
    const elsewhere = createConfig({
      tableAuthority: operator.publicKey,
      programId: Keypair.generate().publicKey,
    });
    expect(reason(signed((key) => cupJoin(elsewhere, key, 8)))).toBe("wrong program");
    // two instructions in one transaction
    const two = new Transaction().add(
      cupJoin(config, owner.publicKey, 8),
      cupJoin(config, owner.publicKey, 9),
    );
    two.feePayer = owner.publicKey;
    two.recentBlockhash = PublicKey.default.toBase58();
    two.partialSign(owner);
    expect(reason(two.serialize({ requireAllSignatures: false }).toString("base64"))).toBe(
      "expected one instruction",
    );
  });

  it("works when the owner is the operator itself", () => {
    const self = createConfig({ tableAuthority: owner.publicKey });
    const transaction = new Transaction().add(cupJoin(self, owner.publicKey, 7));
    transaction.feePayer = owner.publicKey;
    transaction.recentBlockhash = PublicKey.default.toBase58();
    transaction.partialSign(owner);
    const text = transaction.serialize({ requireAllSignatures: false }).toString("base64");
    expect(verifyJoin(text, self, owner.publicKey)).toEqual({
      ok: true,
      owner: owner.publicKey,
      seat: 7,
    });
  });
});
