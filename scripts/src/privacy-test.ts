/**
 * privacy-test (A-2.3): tries to learn private things on the live TEE and checks that only the
 * rightful reader can.
 *
 *   opener     Bob (seat 8): buys, opens and uses a Leak, sends an order
 *   observer   Carol (seat 9): another seat with its own key
 *   authority  the table authority (deployer key), who created every account
 *   anonymous  no key and no token
 *
 * Probes: the mempool and the future; a vault before and after it is opened and after the round
 * reseals it; the transaction of Bob's order, the signatures of the mempool and a live log stream.
 * Public accounts are read as controls, so "saw nothing" cannot just mean "the probe is broken".
 * Writes `docs/proofs/privacy-test.json`; exits non-zero if anyone learned something private.
 *
 *   pnpm privacy-test        (stop the bots first, or they join the round)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { type Connection, Keypair, type PublicKey } from "@solana/web3.js";

import {
  ROOT,
  config as baseConfig,
  bid,
  cancelVrf,
  claimSeat,
  decodeBoard,
  decodeLeakVault,
  decodeTable,
  decodeXray,
  erTxUrl,
  finishRound,
  loadKeypair,
  loadOrCreateKeypair,
  openLeak,
  requestRoundSeed,
  resealLeaks,
  sendOrder,
  sendTx,
  sleep,
  tableAccounts,
  teeConnection,
  tx,
} from "@insider/sdk/node";

import { cycleStateFrom, nextAction } from "./round/cycle.js";
import { type Party, type Probe, judge, sawSomething, summary } from "./privacy/rules.js";

const BOB_SEAT = 8;
const CAROL_SEAT = 9;
const TIMEOUT_MS = 6 * 60 * 1000;

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const keyDir = resolve(ROOT, ".keys/sim");
  const bob = loadOrCreateKeypair(resolve(keyDir, "bob.json"));
  const carol = loadOrCreateKeypair(resolve(keyDir, "carol.json"));

  const conn: Record<Party, Connection> = {
    opener: await teeConnection(config, bob),
    observer: await teeConnection(config, carol),
    authority: await teeConnection(config, authority),
    anonymous: await teeConnection(config),
  };
  const parties = Object.keys(conn) as Party[];
  const others = parties.filter((p) => p !== "opener");

  const probes: Probe[] = [];
  const steps: Array<{ what: string; signature?: string; url?: string }> = [];
  const note = (what: string, signature?: string) => {
    const url = signature ? erTxUrl(signature, config.teeRpcUrl) : undefined;
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${what}${url ? `\n               ${url}` : ""}`,
    );
    steps.push({ what, signature, url });
  };
  const send = async (
    who: Keypair,
    rollup: Connection,
    what: string,
    ...ix: Parameters<typeof tx>
  ) => {
    const { signature, ms } = await sendTx(rollup, tx(...ix), [who]);
    note(`${what} (${ms} ms)`, signature);
    return signature;
  };
  const record = (probe: Probe) => {
    probes.push(probe);
    console.log(
      `  ${probe.saw === probe.shouldSee ? "ok  " : "FAIL"} ${probe.who.padEnd(9)} ${probe.what}: ${probe.saw ? "saw it" : "saw nothing"}${probe.detail ? ` (${probe.detail})` : ""}`,
    );
  };
  const tryRead = async <T>(fn: () => Promise<T>): Promise<unknown> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  /** Every party reads one account; `rightful` is the one party allowed to see it (if any). */
  const readAccount = async (what: string, key: PublicKey, rightful: Party[]) => {
    for (const who of parties) {
      const info = await tryRead(() => conn[who].getAccountInfo(key));
      record({ what, who, shouldSee: rightful.includes(who), saw: sawSomething(info) });
    }
  };

  const read = async () => {
    const [table, board, xray, slot] = await Promise.all([
      conn.authority.getAccountInfo(accounts.table),
      conn.authority.getAccountInfo(accounts.board),
      conn.authority.getAccountInfo(accounts.xray),
      conn.authority.getSlot(),
    ]);
    if (!table || !board || !xray) throw new Error("the table is not readable on the TEE");
    const t = decodeTable(table.data);
    const b = decodeBoard(board.data);
    return { t, b, state: cycleStateFrom(t, b, decodeXray(xray.data), slot) };
  };
  const deadline = Date.now() + TIMEOUT_MS;
  const guard = () => {
    if (Date.now() > deadline) throw new Error("timed out");
  };

  // 1. start a round
  let seenTick = -1;
  let seenAt = Date.now();
  for (let started = false; !started;) {
    guard();
    const { state, t } = await read();
    if (t.tick !== seenTick) {
      seenTick = t.tick;
      seenAt = Date.now();
    } else if (["live", "closing", "xray"].includes(state.phase) && Date.now() - seenAt > 20_000) {
      throw new Error(
        "the table stopped ticking: the crank has expired. Run pnpm setup-table --arm (or start pnpm bots)",
      );
    }
    const action = nextAction(state);
    if (action === "finish_round")
      await send(
        authority,
        conn.authority,
        "finish_round (previous round)",
        finishRound(config, authority.publicKey),
      );
    else if (action === "reseal_leaks")
      await send(
        authority,
        conn.authority,
        "reseal_leaks (previous round)",
        resealLeaks(config, authority.publicKey, 0, 6),
      );
    else if (action === "cancel_vrf")
      await send(authority, conn.authority, "cancel_vrf", cancelVrf(config, authority.publicKey));
    else if (action === "request_round_seed") {
      await send(
        authority,
        conn.authority,
        "request_round_seed",
        requestRoundSeed(config, authority.publicKey),
      );
      started = true;
    } else await sleep(500);
  }
  let round = 0;
  while (!round) {
    guard();
    const { state } = await read();
    if (state.phase === "live") round = state.roundId;
    else await sleep(500);
  }
  note(`round ${round} is live`);
  await send(
    bob,
    conn.opener,
    `Bob claims seat ${BOB_SEAT}`,
    claimSeat(config, bob.publicKey, BOB_SEAT),
  );
  await send(
    carol,
    conn.observer,
    `Carol claims seat ${CAROL_SEAT}`,
    claimSeat(config, carol.publicKey, CAROL_SEAT),
  );

  console.log("\ncontrols (public accounts: everyone should read them)");
  await readAccount("read the table", accounts.table, parties);
  await readAccount("read the board", accounts.board, parties);

  console.log("\nprivate accounts (nobody, not even the authority)");
  await readAccount("read the mempool", accounts.mempool, []);
  await readAccount("read the future (the hidden price path)", accounts.future, []);

  // 2. Bob buys a Leak: it is sealed, so even Bob cannot read the vault yet
  let slot = -1;
  while (slot < 0) {
    guard();
    const { b, state } = await read();
    const auction = b.headers.findIndex((h) => h.state === 1);
    if (state.phase === "live" && auction >= 0) slot = auction;
    else await sleep(500);
  }
  await send(
    bob,
    conn.opener,
    `Bob bids on slot ${slot}`,
    bid(config, bob.publicKey, BOB_SEAT, slot),
  );
  const vault = accounts.leakVaults[slot]!;
  console.log(`\nsealed vault (slot ${slot}, bought but not opened)`);
  await readAccount("read the sealed vault", vault, []);

  // 3. Bob opens it: now only Bob reads it
  await send(
    bob,
    conn.opener,
    `Bob opens slot ${slot}`,
    openLeak(config, bob.publicKey, BOB_SEAT, slot),
  );
  await sleep(1_000);
  console.log("\nopened vault (Bob is the only reader)");
  await readAccount("read the opened vault", vault, ["opener"]);
  const vaultInfo = await conn.opener.getAccountInfo(vault);
  if (vaultInfo) {
    const payload = decodeLeakVault(vaultInfo.data);
    note(`Bob's payload decodes: kind ${payload.kind}, ${payload.orderCount} order(s)`);
  }

  // 4. Bob sends an order while others watch the log streams
  const programLogs: Record<Party, string[]> = {
    opener: [],
    observer: [],
    authority: [],
    anonymous: [],
  };
  const subscriptions: Array<{ conn: Connection; id: number }> = [];
  const refused: string[] = [];
  for (const who of others) {
    try {
      const id = conn[who].onLogs(config.programId, (logs) =>
        programLogs[who].push(logs.signature),
      );
      subscriptions.push({ conn: conn[who], id });
    } catch (error) {
      refused.push(`${who}: ${String(error).slice(0, 60)}`);
    }
  }
  await sleep(1_500);
  const orderSig = await send(
    bob,
    conn.opener,
    "Bob sends a 300-unit buy (the pending order we try to find)",
    sendOrder(config, bob.publicKey, BOB_SEAT, 300, 0),
  );
  await sleep(3_000);

  console.log("\nBob's order transaction and the streams around it");
  // The TEE answers for any signature but strips it: what counts is whether accounts, instruction
  // data (side and size) or logs come back, not whether the signature exists.
  type Tx = {
    transaction: { message: { accountKeys: unknown[]; instructions: unknown[] } };
    meta: { logMessages?: unknown[] | null } | null;
  } | null;
  const content = (t: Tx) =>
    Boolean(
      t &&
      (t.transaction.message.accountKeys.length > 0 ||
        t.transaction.message.instructions.length > 0 ||
        (t.meta?.logMessages?.length ?? 0) > 0),
    );
  for (const who of parties) {
    const found = (await tryRead(() =>
      conn[who].getTransaction(orderSig, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      }),
    )) as Tx;
    const asMember = who === "opener";
    record({
      what: "read the content of the order transaction (accounts, instruction data, logs)",
      who,
      // even Bob may be refused (the order sits in a private account): his own result is recorded, not judged
      shouldSee: asMember ? content(found) : false,
      saw: content(found),
      detail: found ? "the signature exists as an empty shell: slot and success only" : "no record",
    });
  }
  for (const who of parties) {
    const list = await tryRead(() =>
      conn[who].getSignaturesForAddress(accounts.mempool, { limit: 20 }),
    );
    const mine = who === "opener";
    record({
      what: "list signatures that touched the mempool",
      who,
      // the node filters to the caller, so Bob sees his own signatures; judged on the others only
      shouldSee: mine ? sawSomething(list) : false,
      saw: sawSomething(list),
      detail: mine ? "Bob lists his own transactions" : undefined,
    });
  }
  for (const who of others) {
    record({
      what: "see the order in a live log stream of the program",
      who,
      shouldSee: false,
      saw: programLogs[who].includes(orderSig),
      detail: `${programLogs[who].length} program log event(s) received${refused.some((r) => r.startsWith(who)) ? ", subscription refused" : ""}`,
    });
  }
  for (const s of subscriptions) await s.conn.removeOnLogsListener(s.id).catch(() => undefined);

  // 5. the round ends: the vault goes back to nobody, even for Bob
  for (;;) {
    guard();
    const { state } = await read();
    const action = nextAction(state);
    if (action === "finish_round")
      await send(
        authority,
        conn.authority,
        "finish_round",
        finishRound(config, authority.publicKey),
      );
    else if (action === "reseal_leaks")
      await send(
        authority,
        conn.authority,
        "reseal_leaks(0, 6)",
        resealLeaks(config, authority.publicKey, 0, 6),
      );
    else if (state.xrayFinalized && state.readers === 0 && state.roundId === round) break;
    else await sleep(500);
  }
  console.log("\nafter the round (reseal_leaks)");
  await readAccount("read the vault after the reseal", vault, []);
  await readAccount("read the mempool after the round", accounts.mempool, []);

  const results = judge(probes);
  const verdict = summary(results);
  console.log(`\n${verdict.passed}/${verdict.total} probes as expected`);
  if (verdict.leaks.length) console.log(`LEAKS: ${verdict.leaks.join("; ")}`);
  if (verdict.blind.length) console.log(`BLIND CONTROLS: ${verdict.blind.join("; ")}`);

  const out = resolve(ROOT, "docs/proofs/privacy-test.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        table: accounts.table.toBase58(),
        program: config.programId.toBase58(),
        round,
        parties: {
          opener: bob.publicKey.toBase58(),
          observer: carol.publicKey.toBase58(),
          authority: authority.publicKey.toBase58(),
          anonymous: "no key, no token",
        },
        vault: vault.toBase58(),
        mempool: accounts.mempool.toBase58(),
        verdict,
        results,
        steps,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${out}`);
  if (verdict.leaks.length || verdict.blind.length) process.exit(1);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
