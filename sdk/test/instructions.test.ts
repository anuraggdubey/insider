import { BorshInstructionCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import {
  EPHEMERAL_VAULT_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  bid,
  buyLicense,
  buyListed,
  claimSeat,
  createConfig,
  finishRound,
  listLeak,
  offerLicense,
  openLeak,
  ping,
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
