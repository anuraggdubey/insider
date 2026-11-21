import { BN, type Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { Run, labPda, program, send } from "./client.js";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  ROOT,
  VALIDATORS,
  type ValidatorKind,
  config,
  loadKeypair,
  loadOrCreateKeypair,
} from "./config.js";
import { getDelegationStatus, waitFor } from "./rpc.js";
import { teeAuthUrl } from "./tee.js";

export const LAB_SECRET = 424242;

/** Where the lab currently executes: a connection, its program client and its explorer endpoint. */
export type Session = {
  kind: ValidatorKind;
  layer: "ER" | "TEE";
  endpoint: string;
  er: Connection;
  erProgram: Program;
};

export type LabCtx = {
  run: Run;
  payer: Keypair;
  base: Connection;
  baseProgram: Program;
  lab: PublicKey;
  /** Four wallets the VRF may pick: the payer plus three persistent throwaway wallets. */
  candidates: Keypair[];
};

export function labContext(run: Run): LabCtx {
  const payer = loadKeypair(config.walletPath);
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const candidates = [
    payer,
    ...[1, 2, 3].map((n) => loadOrCreateKeypair(`${ROOT}/.keys/lab/candidate-${n}.json`)),
  ];
  return {
    run,
    payer,
    base,
    baseProgram: program(base, payer),
    lab: labPda(payer.publicKey),
    candidates,
  };
}

async function connect(ctx: LabCtx, endpointUrl: string): Promise<Session> {
  const endpoint = endpointUrl.replace(/\/$/, "");
  const isTee = endpoint.includes("tee");
  const url = isTee ? (await teeAuthUrl(endpoint, ctx.payer)).url : endpoint;
  const er = new Connection(url, "confirmed");
  return {
    kind: isTee ? "tee" : "er",
    layer: isTee ? "TEE" : "ER",
    endpoint,
    er,
    erProgram: program(er, ctx.payer),
  };
}

export async function undelegateLab(ctx: LabCtx, session: Session, label = "lab_undelegate") {
  await send(
    session.er,
    ctx.payer,
    await session.erProgram.methods
      .labUndelegate()
      .accounts({
        payer: ctx.payer.publicKey,
        lab: ctx.lab,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .transaction(),
    { run: ctx.run, step: label, layer: session.layer, erUrl: session.endpoint },
  );
  await waitFor("undelegation on base", async () => {
    const info = await ctx.base.getAccountInfo(ctx.lab);
    return info && info.owner.equals(config.programId) ? info : undefined;
  });
}

/**
 * Brings the lab to a known starting point on the base layer: created, undelegated and with no
 * pending randomness request. Safe to call before every experiment.
 */
export async function resetLab(ctx: LabCtx) {
  const { base, baseProgram, payer, lab, run } = ctx;
  let info = await base.getAccountInfo(lab);

  if (!info) {
    await send(
      base,
      payer,
      await baseProgram.methods
        .labInit(
          new BN(LAB_SECRET),
          ctx.candidates.map((candidate) => candidate.publicKey),
        )
        .transaction(),
      { run, step: "lab_init", layer: "base" },
    );
    return;
  }

  if (info.owner.equals(DELEGATION_PROGRAM_ID)) {
    const status = await getDelegationStatus(config.routerUrl, lab);
    if (!status.fqdn) throw new Error("lab is delegated but the router returned no endpoint");
    console.log(`lab is still delegated to ${status.fqdn}; undelegating first`);
    await undelegateLab(ctx, await connect(ctx, status.fqdn), "lab_undelegate (cleanup)");
    info = await base.getAccountInfo(lab);
  }

  const state = baseProgram.coder.accounts.decode("lab", info!.data);
  if (state.pending) {
    await send(
      base,
      payer,
      await baseProgram.methods
        .labCancelRoll()
        .accounts({ authority: payer.publicKey, lab })
        .transaction(),
      { run, step: "lab_cancel_roll (cleanup)", layer: "base" },
    );
  }
}

/** Delegates the lab to the chosen validator and returns a session on the endpoint serving it. */
export async function delegateLab(ctx: LabCtx, kind: ValidatorKind): Promise<Session> {
  await send(
    ctx.base,
    ctx.payer,
    await ctx.baseProgram.methods
      .labDelegate()
      .accounts({ payer: ctx.payer.publicKey, lab: ctx.lab })
      .remainingAccounts([{ pubkey: VALIDATORS[kind], isSigner: false, isWritable: false }])
      .transaction(),
    { run: ctx.run, step: "lab_delegate", layer: "base" },
  );
  const status = await waitFor("router delegation status", async () => {
    const s = await getDelegationStatus(config.routerUrl, ctx.lab);
    return s.isDelegated && s.fqdn ? s : undefined;
  });
  ctx.run.note("endpoint", status.fqdn);
  return connect(ctx, status.fqdn!);
}

export async function readLab(connection: Connection, programClient: Program, lab: PublicKey) {
  const info = await connection.getAccountInfo(lab);
  return info ? programClient.coder.accounts.decode("lab", info.data) : undefined;
}

/** Permission member flags from the Permission Program. */
export const FLAGS = {
  AUTHORITY: 1,
  TX_LOGS: 2,
  TX_BALANCES: 4,
  TX_MESSAGE: 8,
  ACCOUNT_SIGNATURES: 16,
} as const;
export const ALL_FLAGS = 15;

export type Member = { flags: number; pubkey: PublicKey };

export type ReadResult = { visible: boolean; secret?: string; detail: string };

/** Reads the lab through a connection and reports whether the caller can see its data. */
export async function tryRead(
  connection: Connection,
  programClient: Program,
  lab: PublicKey,
): Promise<ReadResult> {
  try {
    const info = await connection.getAccountInfo(lab);
    if (!info) return { visible: false, detail: "account not returned" };
    const state = programClient.coder.accounts.decode("lab", info.data);
    return { visible: true, secret: state.secret.toString(), detail: "data returned" };
  } catch (error) {
    return { visible: false, detail: (error as Error).message.slice(0, 120) };
  }
}
