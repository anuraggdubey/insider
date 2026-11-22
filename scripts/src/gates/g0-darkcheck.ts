/**
 * G0 Darkcheck: can a non-member recover the side and size of an order written into a private
 * account, from any read path the rollup offers? Decides the dark mempool, lanes and Flow Leaks.
 *
 * `probe_send_secret(1234)` plays `send_order`: it writes into the private probe and emits no
 * logs. A sends it. B (a signed-in other key) and an anonymous client then try every path.
 */
import type { Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import idl from "../../../programs/idl/gates.json" with { type: "json" };
import { teeAuthUrl } from "../lib/tee.js";
import {
  ALL_FLAGS,
  FLAGS,
  Gate,
  NOBODY,
  type Ctx,
  type Session,
  closePermission,
  context,
  delegateProbe,
  gateKey,
  resetProbe,
  runIfMain,
  send,
  setPermission,
  sleep,
  undelegateProbe,
} from "./lib.js";

const SECRET = 1234;
const SECRET_2 = 4321;
const sendDiscriminator = Buffer.from(
  (idl.instructions.find((i) => i.name === "probe_send_secret") as { discriminator: number[] })
    .discriminator,
);
const needle = (value: number) => {
  const bytes = Buffer.alloc(2);
  bytes.writeInt16LE(value);
  return Buffer.concat([sendDiscriminator, bytes]);
};

/** Walks a JSON response looking for the secret, as instruction data or as decoded account data. */
function findLeaks(value: unknown, program: Program, secrets: number[]): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (node.length < 8) return;
      const buffers: Buffer[] = [];
      try {
        buffers.push(Buffer.from(node, "base64"));
      } catch {
        /* not base64 */
      }
      try {
        buffers.push(Buffer.from(bs58.decode(node)));
      } catch {
        /* not base58 */
      }
      for (const buffer of buffers) {
        for (const secret of secrets) {
          if (buffer.includes(needle(secret))) found.add(`instruction data carries ${secret}`);
        }
        try {
          const probe = program.coder.accounts.decode("probe", buffer) as { secret: number };
          if (secrets.includes(probe.secret)) found.add(`account data carries ${probe.secret}`);
        } catch {
          /* not a probe account */
        }
      }
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      Object.values(node).forEach(visit);
    }
  };
  visit(value);
  return [...found];
}

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as { result?: unknown; error?: unknown };
  } catch {
    return { error: `HTTP ${response.status}: ${text.slice(0, 80)}` };
  }
}

/** Compact sample of a response, keeping the transaction instructions and logs when present. */
function sampleOf(result: unknown): string {
  const tx = result as {
    transaction?: { message?: { instructions?: unknown } };
    meta?: { logMessages?: unknown };
  } | null;
  if (tx && typeof tx === "object" && tx.transaction?.message) {
    return JSON.stringify({
      instructions: tx.transaction.message.instructions,
      logs: tx.meta?.logMessages,
    }).slice(0, 400);
  }
  return JSON.stringify(result).slice(0, 200);
}

type PathResult = { path: string; returned: boolean; leaks: string[]; detail: string };

/** Tries every read path for one reader. `url` is the (possibly token-carrying) endpoint. */
async function tryAllPaths(
  ctx: Ctx,
  program: Program,
  url: string,
  reader: string,
  signature: string,
  slot: number,
  senderPubkey: PublicKey,
  simulator: Keypair,
): Promise<PathResult[]> {
  const out: PathResult[] = [];
  const secrets = [SECRET, SECRET_2];
  const record = (path: string, response: { result?: unknown; error?: unknown }) => {
    const result = response.result;
    const empty =
      result === null ||
      result === undefined ||
      (Array.isArray(result) && result.length === 0) ||
      (typeof result === "object" &&
        result !== null &&
        "value" in result &&
        (result as { value: unknown }).value === null);
    const leaks = findLeaks(result, program, secrets);
    out.push({
      path,
      returned: !empty && !response.error,
      leaks,
      detail: response.error
        ? JSON.stringify(response.error).slice(0, 90)
        : empty
          ? "nothing returned"
          : `data returned: ${sampleOf(result)}`,
    });
  };

  record(
    "getTransaction",
    await rpc(url, "getTransaction", [
      signature,
      { encoding: "json", maxSupportedTransactionVersion: 0 },
    ]),
  );
  record(
    "getSignaturesForAddress(probe)",
    await rpc(url, "getSignaturesForAddress", [ctx.probe.toBase58(), { limit: 20 }]),
  );
  record(
    "getSignaturesForAddress(sender)",
    await rpc(url, "getSignaturesForAddress", [senderPubkey.toBase58(), { limit: 20 }]),
  );
  record(
    "getAccountInfo(probe)",
    await rpc(url, "getAccountInfo", [ctx.probe.toBase58(), { encoding: "base64" }]),
  );
  record(
    "getBlock(full)",
    await rpc(url, "getBlock", [
      slot,
      { encoding: "json", transactionDetails: "full", maxSupportedTransactionVersion: 0 },
    ]),
  );

  // simulation with post-state accounts: a classic way to read state you were not given
  const simulation = new Transaction();
  simulation.add(
    SystemProgram.transfer({
      fromPubkey: simulator.publicKey,
      toPubkey: simulator.publicKey,
      lamports: 0,
    }),
  );
  simulation.feePayer = simulator.publicKey;
  simulation.recentBlockhash = (await ctx.base.getLatestBlockhash()).blockhash;
  record(
    "simulateTransaction(accounts)",
    await rpc(url, "simulateTransaction", [
      simulation
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        accounts: { encoding: "base64", addresses: [ctx.probe.toBase58()] },
      },
    ]),
  );
  out.forEach((r) => (r.path = `${reader}: ${r.path}`));
  return out;
}

/** Subscribes (logs and account) as one reader, lets A send, and reports what arrived. */
async function tryStreams(
  ctx: Ctx,
  session: Session,
  program: Program,
  url: string,
  reader: string,
  sendAgain: () => Promise<void>,
): Promise<PathResult[]> {
  const connection = new Connection(url, { commitment: "confirmed" });
  const logs: unknown[] = [];
  const accounts: unknown[] = [];
  let logId = -1;
  let accountId = -1;
  try {
    logId = connection.onLogs(ctx.probe, (event) => logs.push(event), "confirmed");
    accountId = connection.onAccountChange(
      ctx.probe,
      (info) => accounts.push(info.data.toString("base64")),
      "confirmed",
    );
  } catch {
    /* subscription refused */
  }
  await sleep(1_500);
  await sendAgain();
  await sleep(4_000);
  if (logId >= 0) await connection.removeOnLogsListener(logId).catch(() => undefined);
  if (accountId >= 0)
    await connection.removeAccountChangeListener(accountId).catch(() => undefined);
  const secrets = [SECRET, SECRET_2];
  const logLeaks = findLeaks(logs, program, secrets);
  const accountLeaks = findLeaks(accounts, program, secrets);
  return [
    {
      path: `${reader}: logsSubscribe(probe)`,
      returned: logs.length > 0,
      leaks: logLeaks,
      detail: `${logs.length} notifications`,
    },
    {
      path: `${reader}: accountSubscribe(probe)`,
      returned: accounts.length > 0,
      leaks: accountLeaks,
      detail: `${accounts.length} notifications`,
    },
  ];
}

export async function run() {
  const gate = new Gate("G0", "Darkcheck");
  const ctx = context(gate);
  const keyA = gateKey("a");
  const keyB = gateKey("b");
  gate.note("probe", ctx.probe.toBase58());
  gate.note("keyA", keyA.publicKey.toBase58());
  gate.note("keyB", keyB.publicKey.toBase58());

  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");
  const asA = await teeAuthUrl(session.endpoint, keyA);
  const asB = await teeAuthUrl(session.endpoint, keyB);
  const asPayer = await teeAuthUrl(session.endpoint, ctx.payer);
  const readers = [
    { name: "payer(member)", url: asPayer.url, simulator: ctx.payer },
    { name: "B(other key)", url: asB.url, simulator: keyB },
    { name: "anonymous", url: session.endpoint, simulator: Keypair.generate() },
  ];

  const doSend = async (value: number, step: string) => {
    const tx = await session.erProgram.methods
      .probeSendSecret(value)
      .accounts({ sender: keyA.publicKey, probe: ctx.probe })
      .transaction();
    return send(gate, session.er, tx, [ctx.payer, keyA], step, "TEE", session.endpoint, ctx.payer);
  };
  const slotOf = async (signature: string) => {
    const status = await session.er.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    return status.context.slot;
  };

  const phases: Array<{ name: string; members: Array<{ flags: number; pubkey: PublicKey }> }> = [
    {
      name: "phase1 private, payer is the only member",
      members: [{ flags: ALL_FLAGS, pubkey: ctx.payer.publicKey }],
    },
    {
      name: "phase2 private, keyless (only member is the nobody PDA)",
      members: [{ flags: FLAGS.AUTHORITY, pubkey: NOBODY }],
    },
  ];

  const all: Array<{ phase: string } & PathResult> = [];
  let created = false;
  for (const phase of phases) {
    console.log(`\n  ${phase.name}`);
    await setPermission(
      ctx,
      session,
      created ? "update" : "create",
      true,
      phase.members,
      `probe_permission_${created ? "update" : "create"} (${phase.name.split(" ")[0]})`,
    );
    created = true;

    const signature = await doSend(
      SECRET,
      `probe_send_secret ${SECRET} (${phase.name.split(" ")[0]})`,
    );
    const slot = await slotOf(signature);
    for (const reader of readers) {
      const program = reader.name === "anonymous" ? session.erProgram : session.erProgram;
      const paths = await tryAllPaths(
        ctx,
        program,
        reader.url,
        reader.name,
        signature,
        slot,
        keyA.publicKey,
        reader.simulator,
      );
      const streams = await tryStreams(ctx, session, program, reader.url, reader.name, async () => {
        await doSend(SECRET_2, `probe_send_secret ${SECRET_2} (stream, ${reader.name})`);
      });
      for (const result of [...paths, ...streams]) all.push({ phase: phase.name, ...result });
    }
  }

  const rows = all.map((r) => ({
    phase: r.phase.split(" ")[0],
    path: r.path,
    returned: r.returned,
    leaks: r.leaks,
    detail: r.detail,
  }));
  gate.note("paths", rows);

  const outsiders = rows.filter((r) => /B\(other key\)|anonymous/.test(r.path));
  const controls = rows.filter((r) => r.path.startsWith("payer(member)") && r.phase === "phase1");
  const leaked = outsiders.filter((r) => r.leaks.length > 0);
  const controlSees = controls.some((r) => r.leaks.length > 0);
  gate.note("controlMemberRecoveredSecret", controlSees);
  gate.note("outsiderLeaks", leaked);

  await closePermission(ctx, session);
  await undelegateProbe(ctx, session);

  if (leaked.length > 0) {
    return gate.finish(
      "cut",
      "A non-member recovered an order from a read path: remove the Flow family and the lanes.",
    );
  }
  if (!controlSees) {
    return gate.finish(
      "error",
      "No leak found, but the member control could not read the secret either, so the test proves nothing.",
    );
  }
  return gate.finish(
    "pass",
    "Non-members and anonymous callers recovered nothing from any path; the member control could read. The dark mempool, lanes and Flow family stay in.",
  );
}

runIfMain(import.meta.url, run);
