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

import { DELEGATION_PROGRAM_ID } from "../lib/config.js";
import type { TableAccounts } from "../lib/insider.js";
import type { AccountState, Batch, Step, Target, TableState } from "./plan.js";

export const accountList = (accounts: TableAccounts) => [
  accounts.table,
  accounts.tape,
  accounts.callBook,
  accounts.season,
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
  return {
    table: state(0),
    tape: state(1),
    callBook: state(2),
    season: state(3),
    seats: accounts.seats.map((_, i) => state(4 + i)),
  };
}

export const addressOf = (accounts: TableAccounts, target: Target): PublicKey =>
  typeof target === "string" ? accounts[target] : accounts.seats[target.seat]!;

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
  if (step.kind === "init") {
    if (target === "table") {
      return methods.initTable(null).accounts({ authority, table }).instruction();
    }
    if (target === "tape") {
      return methods.initTape().accounts({ authority, table, tape: accounts.tape }).instruction();
    }
    if (target === "callBook") {
      return methods
        .initCallBook()
        .accounts({ authority, table, callBook: accounts.callBook })
        .instruction();
    }
    if (target === "season") {
      return methods
        .initSeason()
        .accounts({ authority, table, season: accounts.season })
        .instruction();
    }
    return methods
      .initSeat(target.seat)
      .accounts({ authority, table, seat: accounts.seats[target.seat]! })
      .instruction();
  }

  const remaining = [{ pubkey: validator, isSigner: false, isWritable: false }];
  if (target === "table") {
    return methods
      .delegateTable()
      .accounts({ payer: authority, table })
      .remainingAccounts(remaining)
      .instruction();
  }
  if (target === "tape") {
    return methods
      .delegateTape()
      .accounts({ payer: authority, table, tape: accounts.tape })
      .remainingAccounts(remaining)
      .instruction();
  }
  if (target === "callBook") {
    return methods
      .delegateCallBook()
      .accounts({ payer: authority, table, callBook: accounts.callBook })
      .remainingAccounts(remaining)
      .instruction();
  }
  if (target === "season") {
    return methods
      .delegateSeason()
      .accounts({ payer: authority, table, season: accounts.season })
      .remainingAccounts(remaining)
      .instruction();
  }
  return methods
    .delegateSeat(target.seat)
    .accounts({ payer: authority, table, seat: accounts.seats[target.seat]! })
    .remainingAccounts(remaining)
    .instruction();
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
