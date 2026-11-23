/** Reads the table accounts from chain and turns plan steps into instructions. */
import type { Program } from "@anchor-lang/core";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { DELEGATION_PROGRAM_ID, PERMISSION_PROGRAM_ID } from "../lib/config.js";
import type { TableAccounts } from "../lib/insider.js";
import { MARKET_FLOOR, permissionPdaFromAccount } from "../lib/insider.js";
import {
  SINGLE_ACCOUNTS,
  type AccountState,
  type Batch,
  type PermissionState,
  type PrivateTarget,
  type Step,
  type Target,
  type TableState,
} from "./plan.js";

/** Mirrors `TARGET_*` in `engine_setup.rs`. */
const TARGET_CODE = { mempool: 0, future: 1, vault: 2 } as const;

export const accountList = (accounts: TableAccounts) => [
  ...SINGLE_ACCOUNTS.map((name) => accounts[name]),
  ...accounts.vaults,
  ...accounts.seats,
];

/** Existing and delegated flags for every table account, in one RPC call. */
export async function readState(
  connection: Connection,
  accounts: TableAccounts,
): Promise<TableState> {
  const infos = await connection.getMultipleAccountsInfo(accountList(accounts));
  const state = (index: number): AccountState => {
    const info = infos[index];
    return {
      exists: Boolean(info),
      delegated: Boolean(info && info.owner.equals(DELEGATION_PROGRAM_ID)),
    };
  };
  const single = Object.fromEntries(
    SINGLE_ACCOUNTS.map((name, i) => [name, state(i)]),
  ) as Record<(typeof SINGLE_ACCOUNTS)[number], AccountState>;
  const offset = SINGLE_ACCOUNTS.length;
  return {
    ...single,
    vaults: accounts.vaults.map((_, i) => state(offset + i)),
    seats: accounts.seats.map((_, i) => state(offset + accounts.vaults.length + i)),
  };
}

export const addressOf = (accounts: TableAccounts, target: Target): PublicKey => {
  if (typeof target === "string") return accounts[target];
  return "seat" in target ? accounts.seats[target.seat]! : accounts.vaults[target.vault]!;
};

/** The instruction for one plan step. Delegation names the validator as a remaining account. */
export async function buildInstruction(
  program: Program,
  authority: PublicKey,
  accounts: TableAccounts,
  step: Step,
  validator: PublicKey,
): Promise<TransactionInstruction> {
  const { table } = accounts;
  const target = step.target;
  const methods = program.methods;
  const remaining = [{ pubkey: validator, isSigner: false, isWritable: false }];

  if (step.kind === "init") {
    const base = { authority, table };
    if (typeof target !== "string") {
      return "seat" in target
        ? methods
            .initSeat(target.seat)
            .accounts({ ...base, seat: accounts.seats[target.seat]! })
            .instruction()
        : methods
            .initLeakVault(target.vault)
            .accounts({ ...base, vault: accounts.vaults[target.vault]! })
            .instruction();
    }
    switch (target) {
      case "table":
        return methods.initTable(null).accounts({ authority, table }).instruction();
      case "tape":
        return methods.initTape().accounts({ ...base, tape: accounts.tape }).instruction();
      case "callBook":
        return methods.initCallBook().accounts({ ...base, callBook: accounts.callBook }).instruction();
      case "season":
        return methods.initSeason().accounts({ ...base, season: accounts.season }).instruction();
      case "market":
        return methods.initMarket(MARKET_FLOOR).accounts({ ...base, market: accounts.market }).instruction();
      case "mempool":
        return methods.initMempool().accounts({ ...base, mempool: accounts.mempool }).instruction();
      case "future":
        return methods.initFuture().accounts({ ...base, future: accounts.future }).instruction();
      case "board":
        return methods.initBoard().accounts({ ...base, board: accounts.board }).instruction();
      case "xray":
        return methods.initXray().accounts({ ...base, xray: accounts.xray }).instruction();
    }
  }

  const base = { payer: authority, table };
  if (typeof target !== "string") {
    return "seat" in target
      ? methods
          .delegateSeat(target.seat)
          .accounts({ ...base, seat: accounts.seats[target.seat]! })
          .remainingAccounts(remaining)
          .instruction()
      : methods
          .delegateLeakVault(target.vault)
          .accounts({ ...base, vault: accounts.vaults[target.vault]! })
          .remainingAccounts(remaining)
          .instruction();
  }
  switch (target) {
    case "table":
      return methods.delegateTable().accounts(base).remainingAccounts(remaining).instruction();
    case "tape":
      return methods.delegateTape().accounts({ ...base, tape: accounts.tape }).remainingAccounts(remaining).instruction();
    case "callBook":
      return methods.delegateCallBook().accounts({ ...base, callBook: accounts.callBook }).remainingAccounts(remaining).instruction();
    case "season":
      return methods.delegateSeason().accounts({ ...base, season: accounts.season }).remainingAccounts(remaining).instruction();
    case "market":
      return methods.delegateMarket(MARKET_FLOOR).accounts({ ...base, market: accounts.market }).remainingAccounts(remaining).instruction();
    case "mempool":
      return methods.delegateMempool().accounts({ ...base, mempool: accounts.mempool }).remainingAccounts(remaining).instruction();
    case "future":
      return methods.delegateFuture().accounts({ ...base, future: accounts.future }).remainingAccounts(remaining).instruction();
    case "board":
      return methods.delegateBoard().accounts({ ...base, board: accounts.board }).remainingAccounts(remaining).instruction();
    case "xray":
      return methods.delegateXray().accounts({ ...base, xray: accounts.xray }).remainingAccounts(remaining).instruction();
  }
}

// ---- permissions (rollup) ----------------------------------------------------------------------

export const privateAddress = (accounts: TableAccounts, target: PrivateTarget): PublicKey =>
  typeof target === "string" ? accounts[target] : accounts.vaults[target.vault]!;

/** Which private accounts already have a permission account, read on the rollup. */
export async function readPermissions(
  rollup: Connection,
  accounts: TableAccounts,
): Promise<PermissionState> {
  const keys = [
    accounts.mempool,
    accounts.future,
    ...accounts.vaults,
  ].map((account) => permissionPdaFromAccount(account));
  const infos = await rollup.getMultipleAccountsInfo(keys);
  const has = (i: number) => Boolean(infos[i]?.owner.equals(PERMISSION_PROGRAM_ID));
  return { mempool: has(0), future: has(1), vaults: accounts.vaults.map((_, i) => has(2 + i)) };
}

/** `init_permission`: the authority makes one private account private to the keyless member. */
export async function buildPermissionInstruction(
  program: Program,
  authority: PublicKey,
  accounts: TableAccounts,
  target: PrivateTarget,
): Promise<TransactionInstruction> {
  const address = privateAddress(accounts, target);
  const [code, slot] =
    typeof target === "string" ? [TARGET_CODE[target], 0] : [TARGET_CODE.vault, target.vault];
  return program.methods
    .initPermission(code, slot)
    .accounts({
      authority,
      table: accounts.table,
      target: address,
      permission: permissionPdaFromAccount(address),
    })
    .instruction();
}

/** Sends one batch of permissions to the rollup. */
export async function sendPermissions(
  rollup: Connection,
  program: Program,
  authority: Keypair,
  accounts: TableAccounts,
  targets: PrivateTarget[],
): Promise<string> {
  const tx = new Transaction();
  for (const target of targets) {
    tx.add(await buildPermissionInstruction(program, authority.publicKey, accounts, target));
  }
  return sendAndConfirmTransaction(rollup, tx, [authority], { commitment: "confirmed" });
}

/** Sends one batch as one transaction; delegation batches raise the compute limit to 1.4M. */
export async function sendBatch(
  connection: Connection,
  program: Program,
  authority: Keypair,
  accounts: TableAccounts,
  batch: Batch,
  validator: PublicKey,
): Promise<string> {
  const tx = new Transaction();
  if (batch.steps.some((s) => s.kind === "delegate")) {
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  }
  for (const step of batch.steps) {
    tx.add(await buildInstruction(program, authority.publicKey, accounts, step, validator));
  }
  return sendAndConfirmTransaction(connection, tx, [authority], { commitment: "confirmed" });
}
