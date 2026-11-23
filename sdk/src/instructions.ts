import { BN } from "@anchor-lang/core";
import { BorshInstructionCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import {
  EPHEMERAL_VAULT_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, Transaction, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import rawIdl from "../../programs/idl/insider.json" with { type: "json" };
import {
  EPHEMERAL_VRF_QUEUE,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  type InsiderConfig,
} from "./config";
import { LEAK_SLOTS } from "./constants";
import { tableAccounts } from "./pdas";

const idl = convertIdlToCamelCase(rawIdl as Idl);
const coder = new BorshInstructionCoder(idl);

function addresses(config: InsiderConfig) {
  if (!config.tableAuthority) throw new Error("Table authority is not configured");
  return tableAccounts(config.tableAuthority, config.programId);
}

function build(
  config: InsiderConfig,
  name: string,
  args: Record<string, number | BN>,
  values: Record<string, PublicKey>,
  remaining: AccountMeta[] = [],
): TransactionInstruction {
  const spec = idl.instructions.find((instruction) => instruction.name === name);
  if (!spec) throw new Error(`Unknown instruction ${name}`);
  const keys = spec.accounts.map((account) => {
    if ("accounts" in account) throw new Error("Composite accounts are not supported");
    const pubkey =
      values[account.name] ?? (account.address ? new PublicKey(account.address) : undefined);
    if (!pubkey) throw new Error(`Missing ${name} account ${account.name}`);
    return { pubkey, isSigner: Boolean(account.signer), isWritable: Boolean(account.writable) };
  });
  return new TransactionInstruction({
    programId: config.programId,
    keys: [...keys, ...remaining],
    data: coder.encode(name, args),
  });
}

function action(config: InsiderConfig, owner: PublicKey, index: number) {
  const p = addresses(config);
  const seat = p.seats[index];
  if (!seat) throw new RangeError("Invalid seat");
  return { owner, table: p.table, seat, board: p.board };
}

function permission(config: InsiderConfig, slot: number) {
  const vault = addresses(config).leakVaults[slot];
  if (!vault) throw new RangeError("Invalid leak slot");
  return {
    vault,
    permission: permissionPdaFromAccount(vault),
    permissionProgram: PERMISSION_PROGRAM_ID,
    ephemeralVault: EPHEMERAL_VAULT_ID,
    magicProgram: MAGIC_PROGRAM_ID,
  };
}

export const claimSeat = (config: InsiderConfig, owner: PublicKey, index: number) =>
  build(config, "claimSeat", { index }, action(config, owner, index));
export const ping = (config: InsiderConfig, owner: PublicKey, index: number) =>
  build(config, "ping", { index }, action(config, owner, index));
export const sendOrder = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  sideSize: number,
  lane: number,
) => {
  const p = addresses(config);
  return build(
    config,
    "sendOrder",
    { index, sideSize, lane },
    {
      ...action(config, owner, index),
      market: p.floor,
      mempool: p.mempool,
      tape: p.tape,
    },
  );
};
export const bid = (config: InsiderConfig, owner: PublicKey, index: number, slot: number) =>
  build(config, "bid", { index, slot }, action(config, owner, index));
export const openLeak = (config: InsiderConfig, owner: PublicKey, index: number, slot: number) =>
  build(
    config,
    "openLeak",
    { index, slot },
    { ...action(config, owner, index), ...permission(config, slot) },
  );
export const listLeak = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  ask: number,
) => build(config, "listLeak", { index, slot, ask }, action(config, owner, index));
export const buyListed = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  sellerIndex: number,
) => {
  const sellerSeat = addresses(config).seats[sellerIndex];
  if (!sellerSeat) throw new RangeError("Invalid seller seat");
  return build(
    config,
    "buyListed",
    { index, slot, sellerIndex },
    {
      ...action(config, owner, index),
      sellerSeat,
    },
  );
};
export const offerLicense = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  ask: number,
) => build(config, "offerLicense", { index, slot, ask }, action(config, owner, index));
export const buyLicense = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  ownerIndex: number,
) => {
  const licenseOwner = addresses(config).seats[ownerIndex];
  if (!licenseOwner) throw new RangeError("Invalid license owner");
  return build(
    config,
    "buyLicense",
    { index, slot, ownerIndex },
    {
      ...action(config, owner, index),
      ...permission(config, slot),
      licenseOwner,
    },
  );
};

export function finishRound(config: InsiderConfig, payer: PublicKey) {
  const p = addresses(config);
  const values: Record<string, PublicKey> = {
    payer,
    table: p.table,
    board: p.board,
    xray: p.xray,
    season: p.season,
  };
  p.seats.forEach((key, index) => {
    values[`seat${index}`] = key;
  });
  p.leakVaults.forEach((key, index) => {
    values[`vault${index}`] = key;
  });
  return build(config, "finishRound", {}, values);
}

export function resealLeaks(
  config: InsiderConfig,
  payer: PublicKey,
  slotFrom: number,
  slotTo: number,
) {
  if (
    !Number.isInteger(slotFrom) ||
    !Number.isInteger(slotTo) ||
    slotFrom < 0 ||
    slotTo < slotFrom ||
    slotTo > LEAK_SLOTS
  )
    throw new RangeError("Invalid leak slot range");
  const p = addresses(config);
  const remaining: AccountMeta[] = [];
  for (let slot = slotFrom; slot < slotTo; slot++) {
    const vault = p.leakVaults[slot]!;
    remaining.push(
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: permissionPdaFromAccount(vault), isSigner: false, isWritable: true },
    );
  }
  return build(
    config,
    "resealLeaks",
    { slotFrom, slotTo },
    {
      payer,
      table: p.table,
      board: p.board,
      xray: p.xray,
      permissionProgram: PERMISSION_PROGRAM_ID,
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
    },
    remaining,
  );
}

export const tx = (...instructions: TransactionInstruction[]) => {
  const transaction = new Transaction();
  if (instructions.length) transaction.add(...instructions);
  return transaction;
};

/**
 * Starts the next round through the VRF (table `Idle`, previous round scored and resealed).
 * Anyone may send it; the oracle's callback runs `engine::begin_round` and the round goes `Live`.
 */
export function requestRoundSeed(
  config: InsiderConfig,
  payer: PublicKey,
  oracleQueue: PublicKey = EPHEMERAL_VRF_QUEUE,
) {
  const p = addresses(config);
  return build(
    config,
    "requestRoundSeed",
    {},
    {
      payer,
      table: p.table,
      board: p.board,
      xray: p.xray,
      market: p.floor,
      mempool: p.mempool,
      future: p.future,
      oracleQueue,
      programIdentity: PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("identity")],
        config.programId,
      )[0],
    },
  );
}

/** Frees a table whose seed request never came back (after `VRF_TIMEOUT_TICKS` of silence). */
export const cancelVrf = (config: InsiderConfig, payer: PublicKey) =>
  build(config, "cancelVrf", {}, { payer, table: addresses(config).table });

/** Longest finite crank task one call may schedule (mirrors `MAX_TASK_ITERATIONS`). */
export const MAX_TASK_ITERATIONS = 1_200;

/**
 * Permissionless: extends the tick crank once fewer than 600 ticks of it remain. The remaining
 * accounts are the payer, the Magic program and the table again, then what `tick` needs in the
 * program's order: market, mempool, future, board, xray, tape, six vaults, ten seats.
 */
export function rearmTicks(
  config: InsiderConfig,
  payer: PublicKey,
  taskId: number,
  iterations = MAX_TASK_ITERATIONS,
  intervalMillis = 500,
) {
  const p = addresses(config);
  const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean): AccountMeta => ({
    pubkey,
    isSigner,
    isWritable,
  });
  const engine = [p.floor, p.mempool, p.future, p.board, p.xray, p.tape, ...p.leakVaults, ...p.seats];
  return build(
    config,
    "rearmTicks",
    { taskId: new BN(taskId), intervalMillis: new BN(intervalMillis), iterations: new BN(iterations) },
    { payer, table: p.table, magicProgram: MAGIC_PROGRAM_ID },
    [
      meta(payer, true, true),
      meta(MAGIC_PROGRAM_ID, false, false),
      meta(p.table, false, true),
      ...engine.map((key) => meta(key, false, !key.equals(p.future))),
    ],
  );
}
