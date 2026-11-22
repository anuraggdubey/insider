import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { AnchorProvider, BN, Program, Wallet, type Idl } from "@anchor-lang/core";
import { permissionPdaFromAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import idl from "../../../programs/idl/gates.json" with { type: "json" };
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  ROOT,
  VALIDATORS,
  config,
  loadKeypair,
  loadOrCreateKeypair,
} from "../lib/config.js";
import { baseTxUrl, erTxUrl } from "../lib/explorer.js";
import { getDelegationStatus, sleep, waitFor } from "../lib/rpc.js";
import { teeAuthUrl } from "../lib/tee.js";

export const GATES_PROGRAM_ID = new PublicKey(
  process.env.GATES_PROGRAM_ID || (idl as { address: string }).address,
);
export const TEE_URL = (process.env.TEE_RPC_URL || "https://devnet-tee.magicblock.app").replace(
  /\/$/,
  "",
);
export const ER_URL = "https://devnet-as.magicblock.app";
export const EPHEMERAL_QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");

export type GateStatus = "pass" | "cut" | "info" | "error";
export type Step = {
  step: string;
  layer: "base" | "TEE" | "ER";
  signature: string;
  url: string;
  ms: number;
};
export type GateResult = {
  gate: string;
  name: string;
  status: GateStatus;
  /** What the result means for the build (written into the spec). */
  decision: string;
  facts: Record<string, unknown>;
  steps: Step[];
};

/** Collects every transaction and fact of a gate so it can be written out as proof. */
export class Gate {
  readonly steps: Step[] = [];
  readonly facts: Record<string, unknown> = {};
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  note(key: string, value: unknown) {
    this.facts[key] = value;
    console.log(`  ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  }

  finish(status: GateStatus, decision: string): GateResult {
    const result: GateResult = {
      gate: this.id,
      name: this.name,
      status,
      decision,
      facts: this.facts,
      steps: this.steps,
    };
    const dir = resolve(ROOT, "docs/proofs/gates");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, `${this.id.toLowerCase()}.json`),
      JSON.stringify(
        { ...result, network: "devnet", program: GATES_PROGRAM_ID.toBase58() },
        null,
        2,
      ) + "\n",
    );
    console.log(`${this.id} ${status.toUpperCase()}: ${decision}`);
    return result;
  }
}

export const probePda = (authority: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("probe"), authority.toBuffer()],
    GATES_PROGRAM_ID,
  )[0];

export const gatesProgram = (connection: Connection, payer: Keypair) =>
  new Program(idl as Idl, new AnchorProvider(connection, new Wallet(payer), {}));

export const gateKey = (name: string) => loadOrCreateKeypair(`${ROOT}/.keys/gates/${name}.json`);

/** The keyless reader: a PDA nobody can sign for, so it grants access to no one. */
export const NOBODY = PublicKey.findProgramAddressSync(
  [Buffer.from("nobody")],
  GATES_PROGRAM_ID,
)[0];

export const FLAGS = {
  AUTHORITY: 1,
  TX_LOGS: 2,
  TX_BALANCES: 4,
  TX_MESSAGE: 8,
  ACCOUNT_SIGNATURES: 16,
};
export const ALL_FLAGS = 15;

export async function send(
  gate: Gate,
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  step: string,
  layer: Step["layer"],
  endpoint?: string,
  feePayer: Keypair = signers[0]!,
): Promise<string> {
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const started = performance.now();
  const unique = [...new Map(signers.map((s) => [s.publicKey.toBase58(), s])).values()];
  const signature = await sendAndConfirmTransaction(connection, tx, unique, {
    commitment: "confirmed",
  });
  const ms = Math.round(performance.now() - started);
  const url = layer === "base" || !endpoint ? baseTxUrl(signature) : erTxUrl(signature, endpoint);
  gate.steps.push({ step, layer, signature, url, ms });
  console.log(`  ${layer.padEnd(4)} ${step.padEnd(34)} ${String(ms).padStart(5)}ms ${signature}`);
  return signature;
}

export type Ctx = {
  gate: Gate;
  payer: Keypair;
  base: Connection;
  baseProgram: Program;
  probe: PublicKey;
  permission: PublicKey;
};

export function context(gate: Gate): Ctx {
  const payer = loadKeypair(config.walletPath);
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const probe = probePda(payer.publicKey);
  return {
    gate,
    payer,
    base,
    baseProgram: gatesProgram(base, payer),
    probe,
    permission: permissionPdaFromAccount(probe),
  };
}

export type Session = { endpoint: string; er: Connection; erProgram: Program };

export async function connect(
  ctx: Ctx,
  endpointUrl: string,
  as: Keypair = ctx.payer,
): Promise<Session> {
  const endpoint = endpointUrl.replace(/\/$/, "");
  const isTee = endpoint.includes("tee");
  const url = isTee ? (await teeAuthUrl(endpoint, as)).url : endpoint;
  const er = new Connection(url, "confirmed");
  return { endpoint, er, erProgram: gatesProgram(er, ctx.payer) };
}

const layerOf = (session: Session): Step["layer"] =>
  session.endpoint.includes("tee") ? "TEE" : "ER";

export async function undelegateProbe(ctx: Ctx, session: Session, label = "probe_undelegate") {
  await send(
    ctx.gate,
    session.er,
    await session.erProgram.methods
      .probeUndelegate()
      .accounts({
        payer: ctx.payer.publicKey,
        probe: ctx.probe,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
      .transaction(),
    [ctx.payer],
    label,
    layerOf(session),
    session.endpoint,
  );
  await waitFor("undelegation on base", async () => {
    const info = await ctx.base.getAccountInfo(ctx.probe);
    return info && info.owner.equals(GATES_PROGRAM_ID) ? info : undefined;
  });
  // the base layer finishes cleaning the delegation record just after ownership returns
  await sleep(4_000);
}

/** Creates the probe if needed and returns it to the base layer if a previous run left it delegated. */
export async function resetProbe(ctx: Ctx) {
  const info = await ctx.base.getAccountInfo(ctx.probe);
  if (!info) {
    await send(
      ctx.gate,
      ctx.base,
      await ctx.baseProgram.methods
        .probeInit()
        .accounts({ authority: ctx.payer.publicKey, probe: ctx.probe })
        .transaction(),
      [ctx.payer],
      "probe_init",
      "base",
    );
    return;
  }
  if (info.owner.equals(DELEGATION_PROGRAM_ID)) {
    const status = await getDelegationStatus(config.routerUrl, ctx.probe);
    if (!status.fqdn) throw new Error("probe is delegated but the router returned no endpoint");
    console.log(`  probe still delegated to ${status.fqdn}; undelegating first`);
    const session = await connect(ctx, status.fqdn);
    try {
      await closePermission(ctx, session, "probe_permission_close (cleanup)");
    } catch {
      /* no permission to close */
    }
    await undelegateProbe(ctx, session, "probe_undelegate (cleanup)");
  }
}

export async function delegateProbe(ctx: Ctx, kind: "tee" | "er" = "tee"): Promise<Session> {
  for (let attempt = 1; ; attempt++) {
    try {
      await send(
        ctx.gate,
        ctx.base,
        await ctx.baseProgram.methods
          .probeDelegate()
          .accounts({ payer: ctx.payer.publicKey, probe: ctx.probe })
          .remainingAccounts([{ pubkey: VALIDATORS[kind], isSigner: false, isWritable: false }])
          .transaction(),
        [ctx.payer],
        "probe_delegate",
        "base",
      );
      break;
    } catch (error) {
      if (attempt >= 3 || !/does not own|modified data/.test((error as Error).message)) throw error;
      await sleep(4_000);
    }
  }
  const status = await waitFor("router delegation status", async () => {
    const s = await getDelegationStatus(config.routerUrl, ctx.probe);
    return s.isDelegated && s.fqdn ? s : undefined;
  });
  ctx.gate.note("endpoint", status.fqdn);
  return connect(ctx, status.fqdn!);
}

export type Member = { flags: number; pubkey: PublicKey };

export async function setPermission(
  ctx: Ctx,
  session: Session,
  mode: "create" | "update",
  isPrivate: boolean,
  members: Member[],
  step: string,
) {
  const builder =
    mode === "create"
      ? session.erProgram.methods.probePermissionCreate(isPrivate, members)
      : session.erProgram.methods.probePermissionUpdate(isPrivate, members);
  return send(
    ctx.gate,
    session.er,
    await builder
      .accounts({ authority: ctx.payer.publicKey, probe: ctx.probe, permission: ctx.permission })
      .transaction(),
    [ctx.payer],
    step,
    layerOf(session),
    session.endpoint,
  );
}

export async function closePermission(ctx: Ctx, session: Session, step = "probe_permission_close") {
  return send(
    ctx.gate,
    session.er,
    await session.erProgram.methods
      .probePermissionClose()
      .accounts({ authority: ctx.payer.publicKey, probe: ctx.probe, permission: ctx.permission })
      .transaction(),
    [ctx.payer],
    step,
    layerOf(session),
    session.endpoint,
  );
}

type Num = { toNumber(): number };
export type ProbeState = {
  authority: PublicKey;
  secret: number;
  sends: number;
  lastSender: PublicKey;
  calls: number;
  ticks: number;
  gateSlot: Num;
  logLen: number;
  log: Array<{ slot: Num; unixTimestamp: Num }>;
  oraclePrice: { toString(): string };
  oraclePublishTime: Num;
  oraclePostedSlot: Num;
  oracleClock: Num;
  vrfPending: boolean;
  vrfCalls: number;
  vrfOut: number[];
};

export async function readProbe(connection: Connection, program: Program, probe: PublicKey) {
  const info = await connection.getAccountInfo(probe);
  return info ? (program.coder.accounts.decode("probe", info.data) as ProbeState) : undefined;
}

const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

/** Schedules the crank on the rollup. `vrf` schedules a VRF request instead of a tick (G10). */
export async function scheduleCrank(
  ctx: Ctx,
  session: Session,
  opts: {
    taskId: number;
    intervalMs: number;
    iterations: number;
    minSlots?: number;
    vrf?: boolean;
  },
  step: string,
) {
  const remaining = [
    meta(ctx.payer.publicKey, true, true),
    meta(MAGIC_PROGRAM_ID, false, false),
    meta(ctx.probe, false, true),
  ];
  if (opts.vrf) remaining.push(meta(EPHEMERAL_QUEUE, false, true));
  return send(
    ctx.gate,
    session.er,
    await session.erProgram.methods
      .probeSchedule(
        new BN(opts.taskId),
        new BN(opts.intervalMs),
        new BN(opts.iterations),
        new BN(opts.minSlots ?? 0),
        Boolean(opts.vrf),
      )
      .accounts({
        authority: ctx.payer.publicKey,
        probe: ctx.probe,
        magicProgram: MAGIC_PROGRAM_ID,
      })
      .remainingAccounts(remaining)
      .transaction(),
    [ctx.payer],
    step,
    layerOf(session),
    session.endpoint,
  );
}

export { sleep, loadKeypair };

/** Gate scripts are runnable on their own: runs `fn` when this file is the entry point. */
export function runIfMain(importMetaUrl: string, fn: () => Promise<GateResult>) {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  if (entry && importMetaUrl.endsWith(entry.split("/").pop()!)) {
    fn()
      .then((result) => process.exit(result.status === "error" ? 1 : 0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
}
