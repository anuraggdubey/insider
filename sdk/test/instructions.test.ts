import { BorshInstructionCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import {
  EPHEMERAL_VAULT_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  EPHEMERAL_VRF_QUEUE,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  bid,
  buyLicense,
  cancelVrf,
  commitEpoch,
  allRecoveryTargets,
  cupClose,
  delegationAccounts,
  MAX_TEARDOWN_GROUP,
  RECOVERY_KIND,
  recoveryAddress,
  requestUndelegation,
  rollbackUndelegation,
  teardown,
  cupJoin,
  cupRecord,
  cupSettle,
  deskTrade,
  mintCall,
  buyCallLicense,
  settleCall,
  ORACLE_FEED,
  buyListed,
  claimSeat,
  createConfig,
  finishRound,
  listLeak,
  offerLicense,
  openLeak,
  ping,
  rearmTicks,
  requestRoundSeed,
  resealLeaks,
  sendOrder,
  tableAccounts,
  tx,
} from "../src/index.js";
import idl from "../../programs/idl/insider.json";

const config = createConfig({ tableAuthority: Keypair.generate().publicKey });
const owner = Keypair.generate().publicKey;
const p = tableAccounts(config.tableAuthority!, config.programId);
const coder = new BorshInstructionCoder(convertIdlToCamelCase(idl as Idl));

function check(
  ix: TransactionInstruction,
  keys: PublicKey[],
  flags: string[],
  name: string,
  args: Record<string, number>,
) {
  expect(ix.programId.equals(config.programId)).toBe(true);
  expect(ix.keys.map((key) => key.pubkey.toBase58())).toEqual(keys.map((key) => key.toBase58()));
  expect(ix.keys.map((key) => `${key.isSigner ? "s" : "-"}${key.isWritable ? "w" : "-"}`)).toEqual(
    flags,
  );
  expect(coder.decode(ix.data)).toEqual({ name, data: args });
}

describe("instruction builders", () => {
  it("builds claim, ping, send, bid, listing and license offer with ordered PDAs and IDL arguments", () => {
    const base = [owner, p.table, p.seats[7]!];
    check(claimSeat(config, owner, 7), base, ["s-", "--", "-w"], "claimSeat", { index: 7 });
    check(ping(config, owner, 7), base, ["s-", "--", "-w"], "ping", { index: 7 });
    check(
      sendOrder(config, owner, 7, -250, 1),
      [...base, p.floor, p.mempool, p.tape],
      ["s-", "--", "-w", "--", "-w", "-w"],
      "sendOrder",
      { index: 7, sideSize: -250, lane: 1 },
    );
    check(bid(config, owner, 7, 2), [...base, p.board], ["s-", "--", "-w", "-w"], "bid", {
      index: 7,
      slot: 2,
    });
    check(
      listLeak(config, owner, 7, 2, 85),
      [...base, p.board],
      ["s-", "--", "-w", "-w"],
      "listLeak",
      { index: 7, slot: 2, ask: 85 },
    );
    check(
      offerLicense(config, owner, 7, 2, 35),
      [...base, p.board],
      ["s-", "--", "-w", "-w"],
      "offerLicense",
      { index: 7, slot: 2, ask: 35 },
    );
  });

  it("uses the permission PDA and exact open, resale and license account order", () => {
    const vault = p.leakVaults[2]!;
    const permission = permissionPdaFromAccount(vault);
    const base = [owner, p.table, p.seats[7]!, p.board];
    const permissionKeys = [
      vault,
      permission,
      PERMISSION_PROGRAM_ID,
      EPHEMERAL_VAULT_ID,
      MAGIC_PROGRAM_ID,
    ];
    check(
      openLeak(config, owner, 7, 2),
      [...base, ...permissionKeys],
      ["s-", "--", "-w", "-w", "-w", "-w", "--", "-w", "--"],
      "openLeak",
      { index: 7, slot: 2 },
    );
    check(
      buyListed(config, owner, 7, 2, 1),
      [...base, p.seats[1]!],
      ["s-", "--", "-w", "-w", "-w"],
      "buyListed",
      { index: 7, slot: 2, sellerIndex: 1 },
    );
    check(
      buyLicense(config, owner, 7, 2, 1),
      [...base, p.seats[1]!, ...permissionKeys],
      ["s-", "--", "-w", "-w", "-w", "-w", "-w", "--", "-w", "--"],
      "buyLicense",
      { index: 7, slot: 2, ownerIndex: 1 },
    );
  });

  it("builds split finalization and the half-open reseal account range", () => {
    check(
      finishRound(config, owner),
      [owner, p.table, p.board, p.xray, ...p.seats, p.season, ...p.leakVaults],
      ["s-", "--", "--", "-w", ...Array(10).fill("-w"), "-w", ...Array(6).fill("--")],
      "finishRound",
      {},
    );
    const extra = p.leakVaults
      .slice(1, 3)
      .flatMap((vault) => [vault, permissionPdaFromAccount(vault)]);
    check(
      resealLeaks(config, owner, 1, 3),
      [
        owner,
        p.table,
        p.board,
        p.xray,
        PERMISSION_PROGRAM_ID,
        EPHEMERAL_VAULT_ID,
        MAGIC_PROGRAM_ID,
        ...extra,
      ],
      ["s-", "--", "-w", "--", "--", "-w", "--", ...Array(4).fill("-w")],
      "resealLeaks",
      { slotFrom: 1, slotTo: 3 },
    );
    expect(() => resealLeaks(config, owner, 0, 7)).toThrow();
    expect(tx().instructions).toHaveLength(0);
    expect(tx(claimSeat(config, owner, 7), ping(config, owner, 7)).instructions).toHaveLength(2);
  });
});

describe("round seed builders", () => {
  it("requests the round seed with the engine accounts the callback will write", () => {
    const ix = requestRoundSeed(config, owner);
    const names = ix.keys.map((key) => key.pubkey.toBase58());
    expect(names.slice(0, 7)).toEqual(
      [owner, p.table, p.board, p.xray, p.floor, p.mempool, p.future].map((key) => key.toBase58()),
    );
    expect(ix.keys[7]!.pubkey.equals(EPHEMERAL_VRF_QUEUE)).toBe(true);
    expect(coder.decode(ix.data)).toEqual({ name: "requestRoundSeed", data: {} });
    // only the payer signs; the table and the queue are written
    expect(ix.keys.filter((key) => key.isSigner).map((key) => key.pubkey.toBase58())).toEqual([
      owner.toBase58(),
    ]);
    expect(ix.keys[1]!.isWritable && ix.keys[7]!.isWritable).toBe(true);
  });

  it("cancels a stuck request with just a payer and the table", () => {
    check(cancelVrf(config, owner), [owner, p.table], ["s-", "-w"], "cancelVrf", {});
  });
});

describe("rearmTicks", () => {
  it("passes the payer, magic program and table again, then the tick accounts in program order", () => {
    const ix = rearmTicks(config, owner, 7);
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    // 3 declared accounts, 3 repeated, then 6 + 6 + 10 engine accounts
    expect(ix.keys).toHaveLength(3 + 3 + 22);
    expect(keys.slice(6)).toEqual(
      [p.floor, p.mempool, p.future, p.board, p.xray, p.tape, ...p.leakVaults, ...p.seats].map(
        (k) => k.toBase58(),
      ),
    );
    const future = ix.keys.find((key, i) => i >= 6 && key.pubkey.equals(p.future))!;
    expect(future.isWritable).toBe(false);
    expect(coder.decode(ix.data)?.name).toBe("rearmTicks");
  });
});

describe("commitEpoch", () => {
  it("names the payer, table, X-ray, season and the Magic accounts", () => {
    const ix = commitEpoch(config, owner);
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 4)).toEqual([owner, p.table, p.xray, p.season].map((k) => k.toBase58()));
    expect(keys).toContain(MAGIC_PROGRAM_ID.toBase58());
    expect(coder.decode(ix.data)?.name).toBe("commitEpoch");
    expect(ix.keys.filter((key) => key.isSigner)).toHaveLength(1);
  });
});

describe("the Desk builders", () => {
  it("mints a Call with the call book, its private vault and the oracle", () => {
    const ix = mintCall(config, owner, 8, {
      direction: -1,
      horizon: 120,
      stake: 50,
      licenseAsk: 20,
    });
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 5)).toEqual(
      [owner, p.table, p.seats[8]!, p.callBook, p.callVaults[8]!].map((k) => k.toBase58()),
    );
    expect(keys).toContain(ORACLE_FEED.toBase58());
    expect(keys).toContain(permissionPdaFromAccount(p.callVaults[8]!).toBase58());
    const decoded = coder.decode(ix.data) as { name: string; data: Record<string, unknown> };
    expect(decoded.name).toBe("mintCall");
    expect(decoded.data).toMatchObject({ index: 8, direction: -1, horizon: 120, confidence: 50 });
    expect(String(decoded.data.stake)).toBe("50");
    expect(String(decoded.data.licenseAsk)).toBe("20");
    expect(ix.keys.filter((key) => key.isSigner)).toHaveLength(1);
  });

  it("buys a licence on the author's vault and settles with the season", () => {
    const buy = buyCallLicense(config, owner, 7, 8);
    const keys = buy.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 6)).toEqual(
      [owner, p.table, p.seats[7]!, p.seats[8]!, p.callBook, p.callVaults[8]!].map((k) =>
        k.toBase58(),
      ),
    );
    expect(coder.decode(buy.data)).toEqual({
      name: "buyCallLicense",
      data: { index: 7, authorIndex: 8 },
    });

    const settle = settleCall(config, owner, 8);
    expect(settle.keys.map((key) => key.pubkey.toBase58())).toEqual(
      [owner, p.table, p.seats[8]!, p.callBook, p.callVaults[8]!, p.season, ORACLE_FEED].map((k) =>
        k.toBase58(),
      ),
    );
    expect(settle.keys.filter((key) => key.isWritable).map((key) => key.pubkey.toBase58())).toEqual(
      [p.seats[8]!, p.callBook, p.season].map((k) => k.toBase58()),
    );
  });

  it("trades on the Desk market and rejects an unknown seat", () => {
    const ix = deskTrade(config, owner, 8, -250);
    expect(ix.keys[3]!.pubkey.equals(p.desk)).toBe(true);
    expect(coder.decode(ix.data)).toEqual({ name: "deskTrade", data: { index: 8, size: -250 } });
    expect(() => deskTrade(config, owner, 10, 1)).toThrow(RangeError);
    expect(() => mintCall(config, owner, 10, { direction: 1, horizon: 60, stake: 10 })).toThrow(
      RangeError,
    );
  });
});

describe("the Alpha Cup builders", () => {
  it("joins with two signers: the seat owner and the operator", () => {
    const ix = cupJoin(config, owner, 8);
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 5)).toEqual(
      [owner, config.tableAuthority!, p.table, p.seats[8]!, p.cup].map((k) => k.toBase58()),
    );
    expect(ix.keys.filter((key) => key.isSigner).map((key) => key.pubkey.toBase58())).toEqual([
      owner.toBase58(),
      config.tableAuthority!.toBase58(),
    ]);
    expect(coder.decode(ix.data)).toEqual({ name: "cupJoin", data: { index: 8 } });
    expect(() => cupJoin(config, owner, 10)).toThrow(RangeError);
  });

  it("records, settles and closes with the cup account writable", () => {
    for (const [ix, name] of [
      [cupRecord(config, owner), "cupRecord"],
      [cupSettle(config, owner), "cupSettle"],
      [cupClose(config, owner), "cupClose"],
    ] as const) {
      expect(coder.decode(ix.data)?.name).toBe(name);
      const cup = ix.keys.find((key) => key.pubkey.equals(p.cup))!;
      expect(cup.isWritable).toBe(true);
      expect(ix.keys.filter((key) => key.isSigner)).toHaveLength(1);
    }
  });
});

describe("the recovery builders", () => {
  it("lists every account of the table once, the table last", () => {
    const targets = allRecoveryTargets();
    const addresses = targets.map((target) => recoveryAddress(config, target).toBase58());
    expect(new Set(addresses).size).toBe(addresses.length);
    // 10 singles (tape, call book, season, cup, mempool, future, board, X-ray, 2 markets) + 6 + 10 + 10 + the table
    expect(targets).toHaveLength(8 + 2 + 6 + 10 + 10 + 1);
    expect(targets.at(-1)).toEqual({ kind: RECOVERY_KIND.table, slot: 0 });
    expect(recoveryAddress(config, { kind: RECOVERY_KIND.market, slot: 1 }).equals(p.desk)).toBe(
      true,
    );
    expect(recoveryAddress(config, { kind: RECOVERY_KIND.seat, slot: 4 }).equals(p.seats[4]!)).toBe(
      true,
    );
    expect(() => recoveryAddress(config, { kind: RECOVERY_KIND.seat, slot: 10 })).toThrow(
      RangeError,
    );
    expect(() => recoveryAddress(config, { kind: 99, slot: 0 })).toThrow(RangeError);
  });

  it("builds a teardown with the table named and the rest as writable remaining accounts in order", () => {
    const group = [
      { kind: RECOVERY_KIND.xray, slot: 0 },
      { kind: RECOVERY_KIND.seat, slot: 2 },
      { kind: RECOVERY_KIND.table, slot: 0 },
    ];
    const ix = teardown(config, owner, group, true);
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 2)).toEqual([owner, p.table].map((k) => k.toBase58()));
    expect(keys.slice(-2)).toEqual([p.xray, p.seats[2]!].map((k) => k.toBase58()));
    expect(ix.keys.slice(-2).every((key) => key.isWritable && !key.isSigner)).toBe(true);
    expect(ix.keys.filter((key) => key.isSigner).map((key) => key.pubkey.toBase58())).toEqual([
      owner.toBase58(),
    ]);
    const decoded = coder.decode(ix.data) as {
      name: string;
      data: { kinds: Buffer; slots: Buffer; force: boolean };
    };
    expect(decoded.name).toBe("teardown");
    expect([...decoded.data.kinds]).toEqual([
      RECOVERY_KIND.xray,
      RECOVERY_KIND.seat,
      RECOVERY_KIND.table,
    ]);
    expect([...decoded.data.slots]).toEqual([0, 2, 0]);
    expect(decoded.data.force).toBe(true);
  });

  it("refuses an empty group and a group of nine", () => {
    expect(() => teardown(config, owner, [])).toThrow(RangeError);
    const nine = Array.from({ length: 9 }, (_, slot) => ({ kind: RECOVERY_KIND.callVault, slot }));
    expect(() => teardown(config, owner, nine)).toThrow(RangeError);
    expect(MAX_TEARDOWN_GROUP).toBe(8);
  });

  it("asks the Delegation program for one account with its own PDAs", () => {
    const target = { kind: RECOVERY_KIND.cup, slot: 0 };
    const ix = requestUndelegation(config, owner, target);
    const dlp = delegationAccounts(p.cup);
    const keys = ix.keys.map((key) => key.pubkey.toBase58());
    expect(keys.slice(0, 3)).toEqual([owner, p.table, p.cup].map((k) => k.toBase58()));
    for (const key of [
      dlp.undelegationRequest,
      dlp.delegationRecord,
      dlp.delegationMetadata,
      dlp.commitState,
      dlp.commitRecord,
    ]) {
      expect(keys).toContain(key.toBase58());
    }
    expect(coder.decode(ix.data)).toEqual({
      name: "requestUndelegation",
      data: { kind: RECOVERY_KIND.cup, slot: 0 },
    });
    expect(coder.decode(rollbackUndelegation(config, owner, target).data)?.name).toBe(
      "rollbackUndelegation",
    );
  });
});
