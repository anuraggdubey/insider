import { BN } from "@anchor-lang/core";
import { BorshInstructionCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import {
  EPHEMERAL_VAULT_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey, Transaction, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import rawIdl from "../../programs/idl/insider.json" with { type: "json" };
import {
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_VRF_QUEUE,
  ORACLE_FEED,
  MAGIC_CONTEXT_ID,
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
  args: Record<string, number | boolean | BN | Buffer>,
  values: Record<string, PublicKey>,
  remaining: AccountMeta[] = [],
): TransactionInstruction {
  const spec = idl.instructions.find((instruction) => instruction.name === name);
  if (!spec) throw new Error(`Unknown instruction ${name}`);
  const keys = spec.accounts.map((account) => {
    if ("accounts" in account) throw new Error("Composite accounts are not supported");
    const pubkey =
      values[account.name] ??
      (account.address
        ? new PublicKey(account.address)
        : account.optional
          ? config.programId
          : undefined);
    if (!pubkey) throw new Error(`Missing ${name} account ${account.name}`);
    return { pubkey, isSigner: Boolean(account.signer), isWritable: Boolean(account.writable) };
  });
  return new TransactionInstruction({
    programId: config.programId,
    keys: [...keys, ...remaining],
    data: coder.encode(name, args),
  });
}

function action(config: InsiderConfig, owner: PublicKey, index: number, session?: PublicKey) {
  const p = addresses(config);
  const seat = p.seats[index];
  if (!seat) throw new RangeError("Invalid seat");
  return {
    owner,
    table: p.table,
    seat,
    board: p.board,
    ...(session ? { sessionToken: session } : {}),
  };
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
export const ping = (config: InsiderConfig, owner: PublicKey, index: number, session?: PublicKey) =>
  build(config, "ping", { index }, action(config, owner, index, session));
export const sendOrder = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  sideSize: number,
  lane: number,
  session?: PublicKey,
) => {
  const p = addresses(config);
  return build(
    config,
    "sendOrder",
    { index, sideSize, lane },
    {
      ...action(config, owner, index, session),
      market: p.floor,
      mempool: p.mempool,
      tape: p.tape,
    },
  );
};
export const bid = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  session?: PublicKey,
) => build(config, "bid", { index, slot }, action(config, owner, index, session));
export const openLeak = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  session?: PublicKey,
) =>
  build(
    config,
    "openLeak",
    { index, slot },
    { ...action(config, owner, index, session), ...permission(config, slot) },
  );
export const listLeak = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  ask: number,
  session?: PublicKey,
) => build(config, "listLeak", { index, slot, ask }, action(config, owner, index, session));
export const buyListed = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  sellerIndex: number,
  session?: PublicKey,
) => {
  const sellerSeat = addresses(config).seats[sellerIndex];
  if (!sellerSeat) throw new RangeError("Invalid seller seat");
  return build(
    config,
    "buyListed",
    { index, slot, sellerIndex },
    {
      ...action(config, owner, index, session),
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
  session?: PublicKey,
) => build(config, "offerLicense", { index, slot, ask }, action(config, owner, index, session));
export const buyLicense = (
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  slot: number,
  ownerIndex: number,
  session?: PublicKey,
) => {
  const licenseOwner = addresses(config).seats[ownerIndex];
  if (!licenseOwner) throw new RangeError("Invalid license owner");
  return build(
    config,
    "buyLicense",
    { index, slot, ownerIndex },
    {
      ...action(config, owner, index, session),
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
  const engine = [
    p.floor,
    p.mempool,
    p.future,
    p.board,
    p.xray,
    p.tape,
    ...p.leakVaults,
    ...p.seats,
  ];
  return build(
    config,
    "rearmTicks",
    {
      taskId: new BN(taskId),
      intervalMillis: new BN(intervalMillis),
      iterations: new BN(iterations),
    },
    { payer, table: p.table, magicProgram: MAGIC_PROGRAM_ID },
    [
      meta(payer, true, true),
      meta(MAGIC_PROGRAM_ID, false, false),
      meta(p.table, false, true),
      ...engine.map((key) => meta(key, false, !key.equals(p.future))),
    ],
  );
}

/**
 * Rollup, anyone: advances the table to the tick the rollup clock has reached (idempotent, so
 * early or duplicate calls change nothing). Built by hand because `scheduler` and `crank_signer`
 * are no longer checked: any caller fills both slots.
 */
export function tickTable(config: InsiderConfig, caller: PublicKey) {
  const p = addresses(config);
  const engine = [
    p.floor,
    p.mempool,
    p.future,
    p.board,
    p.xray,
    p.tape,
    ...p.leakVaults,
    ...p.seats,
  ];
  return new TransactionInstruction({
    programId: config.programId,
    keys: [
      { pubkey: p.table, isSigner: false, isWritable: true },
      { pubkey: caller, isSigner: false, isWritable: false },
      { pubkey: caller, isSigner: false, isWritable: false },
      ...engine.map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: !pubkey.equals(p.future),
      })),
    ],
    data: coder.encode("tick", {}),
  });
}

/**
 * Rollup, anyone: once the epoch is over and its last round is scored, commits `Season` to the base
 * layer and undelegates it. The operator then runs `open_epoch` on the base layer.
 */
export function commitEpoch(config: InsiderConfig, payer: PublicKey) {
  const p = addresses(config);
  return build(
    config,
    "commitEpoch",
    {},
    { payer, table: p.table, xray: p.xray, season: p.season, magicContext: MAGIC_CONTEXT_ID },
  );
}

// ---- the Desk ----------------------------------------------------------------------------------

function callVaultPermission(config: InsiderConfig, slot: number) {
  const vault = addresses(config).callVaults[slot];
  if (!vault) throw new RangeError("Invalid seat");
  return {
    vault,
    permission: permissionPdaFromAccount(vault),
    permissionProgram: PERMISSION_PROGRAM_ID,
    ephemeralVault: EPHEMERAL_VAULT_ID,
    magicProgram: MAGIC_PROGRAM_ID,
  };
}

/** Horizons a Call may have, in seconds. */
export const CALL_HORIZONS = [60, 120, 180] as const;

/**
 * Commits to "up" (+1) or "down" (-1) on SOL/USD. The stake (10 to 200 Desk chips) leaves the seat
 * now; a Right Call returns it with a 50% bonus. The direction is private until the Call is judged.
 */
export function mintCall(
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  call: {
    direction: 1 | -1;
    horizon: number;
    stake: number;
    licenseAsk?: number;
    confidence?: number;
  },
  session?: PublicKey,
) {
  const p = addresses(config);
  const seat = p.seats[index];
  if (!seat) throw new RangeError("Invalid seat");
  return build(
    config,
    "mintCall",
    {
      index,
      direction: call.direction,
      horizon: call.horizon,
      stake: new BN(call.stake),
      licenseAsk: new BN(call.licenseAsk ?? 0),
      confidence: call.confidence ?? 50,
    },
    {
      owner,
      table: p.table,
      seat,
      callBook: p.callBook,
      ...callVaultPermission(config, index),
      oracle: ORACLE_FEED,
      ...(session ? { sessionToken: session } : {}),
    },
  );
}

/** Pays the author's asking price in Desk chips and joins the readers of an open Call. */
export function buyCallLicense(
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  authorIndex: number,
  session?: PublicKey,
) {
  const p = addresses(config);
  const seat = p.seats[index];
  const authorSeat = p.seats[authorIndex];
  if (!seat || !authorSeat) throw new RangeError("Invalid seat");
  return build(
    config,
    "buyCallLicense",
    { index, authorIndex },
    {
      owner,
      table: p.table,
      seat,
      authorSeat,
      callBook: p.callBook,
      ...callVaultPermission(config, authorIndex),
      ...(session ? { sessionToken: session } : {}),
    },
  );
}

/** Anyone: judges a Call that is due against the oracle and updates the author's record. */
export function settleCall(config: InsiderConfig, payer: PublicKey, authorIndex: number) {
  const p = addresses(config);
  const authorSeat = p.seats[authorIndex];
  const vault = p.callVaults[authorIndex];
  if (!authorSeat || !vault) throw new RangeError("Invalid seat");
  return build(
    config,
    "settleCall",
    { authorIndex },
    {
      payer,
      table: p.table,
      authorSeat,
      callBook: p.callBook,
      vault,
      season: p.season,
      oracle: ORACLE_FEED,
    },
  );
}

/** Trades Desk units (1/100 SOL each, negative sells) at the oracle price. */
export function deskTrade(
  config: InsiderConfig,
  owner: PublicKey,
  index: number,
  size: number,
  session?: PublicKey,
) {
  const p = addresses(config);
  const seat = p.seats[index];
  if (!seat) throw new RangeError("Invalid seat");
  return build(
    config,
    "deskTrade",
    { index, size },
    {
      owner,
      table: p.table,
      seat,
      market: p.desk,
      oracle: ORACLE_FEED,
      ...(session ? { sessionToken: session } : {}),
    },
  );
}

// ---- the Alpha Cup -----------------------------------------------------------------------------

/**
 * Enters the cup with a human seat. It needs two signatures: the seat owner and the operator (the
 * table authority), who co-signs only after seeing the buy-in. Sign as the owner, then send the
 * transaction to the operator service to be co-signed and submitted.
 */
export function cupJoin(config: InsiderConfig, owner: PublicKey, index: number) {
  const p = addresses(config);
  const seat = p.seats[index];
  if (!seat) throw new RangeError("Invalid seat");
  return build(
    config,
    "cupJoin",
    { index },
    { owner, operator: config.tableAuthority!, table: p.table, seat, cup: p.cup },
  );
}

/** Anyone: after `finish_round`, adds the scored round to the cup (once per round). */
export function cupRecord(config: InsiderConfig, payer: PublicKey) {
  const p = addresses(config);
  return build(config, "cupRecord", {}, { payer, table: p.table, xray: p.xray, cup: p.cup });
}

/** Anyone: after five recorded rounds, ranks the entrants and fixes the prize split. */
export function cupSettle(config: InsiderConfig, payer: PublicKey) {
  const p = addresses(config);
  return build(config, "cupSettle", {}, { payer, table: p.table, cup: p.cup });
}

/** The operator, after paying the prizes: starts the next cup. */
export function cupClose(config: InsiderConfig, operator: PublicKey) {
  const p = addresses(config);
  return build(config, "cupClose", {}, { operator, table: p.table, cup: p.cup });
}

// ---- recovery ----------------------------------------------------------------------------------

/** Mirrors the `KIND_*` constants of `recovery.rs`. The slot is the market kind, vault slot or seat. */
export const RECOVERY_KIND = {
  table: 0,
  tape: 1,
  callBook: 2,
  season: 3,
  market: 4,
  cup: 5,
  mempool: 6,
  future: 7,
  board: 8,
  xray: 9,
  leakVault: 10,
  callVault: 11,
  seat: 12,
} as const;

export type RecoveryTarget = { kind: number; slot: number };

/** Most accounts one teardown intent may hold (the TEE hangs at ten). */
export const MAX_TEARDOWN_GROUP = 8;

/** The address a recovery target names. */
export function recoveryAddress(config: InsiderConfig, target: RecoveryTarget): PublicKey {
  const p = addresses(config);
  const { kind, slot } = target;
  const pick = <T>(list: T[]): T => {
    const found = list[slot];
    if (found === undefined) throw new RangeError("Invalid recovery slot");
    return found;
  };
  switch (kind) {
    case RECOVERY_KIND.table:
      return p.table;
    case RECOVERY_KIND.tape:
      return p.tape;
    case RECOVERY_KIND.callBook:
      return p.callBook;
    case RECOVERY_KIND.season:
      return p.season;
    case RECOVERY_KIND.market:
      return pick([p.floor, p.desk]);
    case RECOVERY_KIND.cup:
      return p.cup;
    case RECOVERY_KIND.mempool:
      return p.mempool;
    case RECOVERY_KIND.future:
      return p.future;
    case RECOVERY_KIND.board:
      return p.board;
    case RECOVERY_KIND.xray:
      return p.xray;
    case RECOVERY_KIND.leakVault:
      return pick(p.leakVaults);
    case RECOVERY_KIND.callVault:
      return pick(p.callVaults);
    case RECOVERY_KIND.seat:
      return pick(p.seats);
    default:
      throw new RangeError("Invalid recovery kind");
  }
}

/** Every account of the table, in the order a teardown should take them (the table last). */
export function allRecoveryTargets(): RecoveryTarget[] {
  const targets: RecoveryTarget[] = [
    ...[RECOVERY_KIND.tape, RECOVERY_KIND.callBook, RECOVERY_KIND.season, RECOVERY_KIND.cup],
    RECOVERY_KIND.mempool,
    RECOVERY_KIND.future,
    RECOVERY_KIND.board,
    RECOVERY_KIND.xray,
  ].map((kind) => ({ kind, slot: 0 }));
  targets.push({ kind: RECOVERY_KIND.market, slot: 0 }, { kind: RECOVERY_KIND.market, slot: 1 });
  for (let i = 0; i < 6; i++) targets.push({ kind: RECOVERY_KIND.leakVault, slot: i });
  for (let i = 0; i < 10; i++) targets.push({ kind: RECOVERY_KIND.callVault, slot: i });
  for (let i = 0; i < 10; i++) targets.push({ kind: RECOVERY_KIND.seat, slot: i });
  targets.push({ kind: RECOVERY_KIND.table, slot: 0 });
  return targets;
}

/**
 * Rollup, authority: commit and undelegate up to eight accounts in one intent. The table is the
 * named account; every other target follows as a remaining account, in order. Without `force` the
 * table must be idle.
 */
export function teardown(
  config: InsiderConfig,
  payer: PublicKey,
  targets: RecoveryTarget[],
  force = false,
) {
  if (targets.length === 0 || targets.length > MAX_TEARDOWN_GROUP) {
    throw new RangeError("A teardown group holds one to eight accounts");
  }
  const p = addresses(config);
  const remaining: AccountMeta[] = targets
    .filter((target) => target.kind !== RECOVERY_KIND.table)
    .map((target) => ({
      pubkey: recoveryAddress(config, target),
      isSigner: false,
      isWritable: true,
    }));
  return build(
    config,
    "teardown",
    {
      kinds: Buffer.from(targets.map((target) => target.kind)),
      slots: Buffer.from(targets.map((target) => target.slot)),
      force,
    },
    { payer, table: p.table, magicContext: MAGIC_CONTEXT_ID },
    remaining,
  );
}

const dlpAddress = (tag: string, delegated: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(tag), delegated.toBytes()],
    DELEGATION_PROGRAM_ID,
  )[0];

/** The Delegation program's PDAs for one delegated account. */
export function delegationAccounts(delegated: PublicKey) {
  return {
    undelegationRequest: dlpAddress("undelegation-request", delegated),
    delegationRecord: dlpAddress("delegation", delegated),
    delegationMetadata: dlpAddress("delegation-metadata", delegated),
    commitState: dlpAddress("state-diff", delegated),
    commitRecord: dlpAddress("commit-state-record", delegated),
  };
}

function recover(
  name: "requestUndelegation" | "rollbackUndelegation",
  config: InsiderConfig,
  authority: PublicKey,
  target: RecoveryTarget,
) {
  const target_ = recoveryAddress(config, target);
  return build(
    config,
    name,
    { kind: target.kind, slot: target.slot },
    {
      authority,
      table: addresses(config).table,
      target: target_,
      ...delegationAccounts(target_),
    },
  );
}

/**
 * Base layer, authority: asks the Delegation program to undelegate one account (for a rollup that
 * is not answering). The validator normally returns the account to the base layer.
 */
export const requestUndelegation = (
  config: InsiderConfig,
  authority: PublicKey,
  target: RecoveryTarget,
) => recover("requestUndelegation", config, authority, target);

/** Base layer, authority: after the request's timeout, takes the account back at its last commit. */
export const rollbackUndelegation = (
  config: InsiderConfig,
  authority: PublicKey,
  target: RecoveryTarget,
) => recover("rollbackUndelegation", config, authority, target);
