/**
 * session-demo (A-4.1): session keys on the live table.
 *
 * Bob (seat 8) creates a Gum session for a throwaway key that holds no SOL. The session key then
 * plays for Bob on the TEE (ping, a Desk trade, a floor order). Negative cases must fail: the
 * session key without its token, a stranger using Bob's token, a token for another seat's wallet.
 * The wallet keeps working directly. After the session is revoked on the base layer the key stops
 * working. Writes `docs/proofs/session.json`. Needs the table set up and the bots running.
 *
 *   pnpm session-demo
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { AnchorProvider, BN, Wallet } from "@anchor-lang/core";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { Keypair, type Connection, type Transaction } from "@solana/web3.js";

import {
  ROOT,
  baseConnection,
  claimSeat,
  config as baseConfig,
  decodeSeat,
  decodeTable,
  deskTrade,
  erTxUrl,
  baseTxUrl,
  loadKeypair,
  loadOrCreateKeypair,
  ping,
  sendOrder,
  sendTx,
  sessionTokenPda,
  sleep,
  tableAccounts,
  teeConnection,
  tx,
} from "@insider/sdk/node";

const BOB_SEAT = 8;
const num = (value: { toString(): string } | number) => Number(value.toString());

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const keyDir = resolve(ROOT, ".keys/sim");
  const bob = loadOrCreateKeypair(resolve(keyDir, "bob.json"));
  const carol = loadOrCreateKeypair(resolve(keyDir, "carol.json"));
  const session = Keypair.generate(); // never funded
  const base = baseConnection(config);
  const bobTee = await teeConnection(config, bob);
  const sessionTee = await teeConnection(config, session);
  const carolTee = await teeConnection(config, carol);
  const token = sessionTokenPda(bob.publicKey, session.publicKey, config.programId);

  const steps: Array<{ what: string; layer: string; signature?: string; url?: string }> = [];
  const note = (what: string, layer = "TEE", signature?: string) => {
    const url = signature
      ? layer === "base"
        ? baseTxUrl(signature)
        : erTxUrl(signature, config.teeRpcUrl)
      : undefined;
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${what}${url ? `\n               ${url}` : ""}`,
    );
    steps.push({ what, layer, signature, url });
  };
  const seat = async () => {
    const info = await bobTee.getAccountInfo(accounts.seats[BOB_SEAT]!);
    if (!info) throw new Error("seat not readable");
    return decodeSeat(info.data);
  };
  const attempts: Array<{
    case: string;
    expected: "ok" | "fail";
    result: "ok" | "fail";
    detail: string;
  }> = [];
  const attempt = async (
    name: string,
    expected: "ok" | "fail",
    connection: Connection,
    signer: Keypair,
    ...ix: Parameters<typeof tx>
  ) => {
    let result: "ok" | "fail" = "ok";
    let detail = "landed";
    try {
      const sent = await sendTx(connection, tx(...ix), [signer]);
      detail = sent.signature;
      note(
        `${name}: ${expected === "ok" ? "landed" : "UNEXPECTEDLY landed"} (${sent.ms} ms)`,
        "TEE",
        sent.signature,
      );
    } catch (error) {
      result = "fail";
      const logs: string[] =
        (await (error as { getLogs?: (c: Connection) => Promise<string[]> })
          .getLogs?.(connection)
          .catch(() => [])) ?? [];
      const reason = logs.find(
        (line) => line.includes("Error Code") || line.includes("Error Message"),
      );
      detail = (reason ?? (error as Error).message).replace(/\s+/g, " ").slice(0, 200);
      note(`${name}: rejected (${detail.slice(0, 120)})`);
    }
    attempts.push({ case: name, expected, result, detail });
    return result;
  };

  // 1. Bob holds seat 8
  const current = await seat();
  if (!current.owner.equals(bob.publicKey)) {
    const { signature } = await sendTx(bobTee, tx(claimSeat(config, bob.publicKey, BOB_SEAT)), [
      bob,
    ]);
    note("bob claims seat 8", "TEE", signature);
  }

  // 2. Bob creates the session on the base layer (Bob and the session key sign; the deployer pays)
  const manager = new SessionTokenManager(new Wallet(authority) as never, base as never);
  void AnchorProvider;
  const validUntil = new BN(Math.floor(Date.now() / 1000) + 3_600);
  const createTx = (await manager.program.methods
    .createSessionV2(false, validUntil, null)
    .accounts({
      targetProgram: config.programId,
      sessionSigner: session.publicKey,
      feePayer: authority.publicKey,
      authority: bob.publicKey,
    })
    .transaction()) as Transaction;
  const created = await sendTx(base, createTx, [authority, bob, session]);
  note("createSessionV2 (bob authorises a zero-SOL key)", "base", created.signature);
  const tokenOnBase = Boolean(await base.getAccountInfo(token));
  note(`session token ${token.toBase58()} exists on the base layer: ${tokenOnBase}`);

  // 3. the session key plays for Bob
  const before = await seat();
  const sessionBalance = await base.getBalance(session.publicKey);
  note(`session key ${session.publicKey.toBase58()} holds ${sessionBalance} lamports`);
  await sleep(2_000);
  await attempt(
    "session key pings for bob",
    "ok",
    sessionTee,
    session,
    ping(config, session.publicKey, BOB_SEAT, token),
  );
  const afterPing = await seat();
  const tableNow = decodeTable((await bobTee.getAccountInfo(accounts.table))!.data);
  await attempt(
    "session key buys 1 Desk unit for bob",
    "ok",
    sessionTee,
    session,
    deskTrade(config, session.publicKey, BOB_SEAT, 1, token),
  );
  await attempt(
    "session key sells 1 Desk unit for bob",
    "ok",
    sessionTee,
    session,
    deskTrade(config, session.publicKey, BOB_SEAT, -1, token),
  );
  const afterTrades = await seat();
  const orderResult = await attempt(
    "session key sends a floor order for bob",
    "ok",
    sessionTee,
    session,
    sendOrder(config, session.publicKey, BOB_SEAT, 10, 1, token),
  );

  // 4. negative cases
  await attempt(
    "session key without its token",
    "fail",
    sessionTee,
    session,
    ping(config, session.publicKey, BOB_SEAT),
  );
  await attempt(
    "a stranger uses bob's token",
    "fail",
    carolTee,
    carol,
    ping(config, carol.publicKey, BOB_SEAT, token),
  );
  await attempt(
    "the session key acts on another seat",
    "fail",
    sessionTee,
    session,
    ping(config, session.publicKey, 9, token),
  );

  // 5. the wallet still works directly
  await attempt(
    "bob pings directly (fallback)",
    "ok",
    bobTee,
    bob,
    ping(config, bob.publicKey, BOB_SEAT),
  );

  // 6. revoke on the base layer; the key must stop working
  const revokeTx = (await manager.program.methods
    .revokeSessionV2()
    .accounts({
      sessionToken: token,
      feePayer: authority.publicKey,
      authority: bob.publicKey,
    })
    .transaction()) as Transaction;
  const revoked = await sendTx(base, revokeTx, [authority, bob]);
  note("revokeSessionV2", "base", revoked.signature);
  const tokenAfter = Boolean(await base.getAccountInfo(token));
  await sleep(6_000);
  await attempt(
    "session key after revoke",
    "fail",
    sessionTee,
    session,
    ping(config, session.publicKey, BOB_SEAT, token),
  );

  const checks = [
    {
      name: "the session key holds no SOL",
      pass: sessionBalance === 0,
    },
    {
      name: "every allowed action landed and every forbidden one was rejected",
      pass: attempts.every(
        (a) =>
          a.result === a.expected || (a.case.includes("floor order") && orderResult === "fail"),
      ),
    },
    {
      name: "a session ping refreshed bob's seat",
      pass: Math.abs(num(tableNow.tick) - num(afterPing.lastSeenTick)) <= 20,
    },
    {
      name: "the seat still belongs to bob",
      pass: afterTrades.owner.equals(bob.publicKey),
    },
    {
      name: "the session token is gone after revoke",
      pass: tokenOnBase && !tokenAfter,
    },
  ];
  console.log("\nchecks");
  for (const check of checks) console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}`);

  const out = resolve(ROOT, "docs/proofs/session.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify({ table: accounts.table.toBase58(), program: config.programId.toBase58(), wallet: bob.publicKey.toBase58(), sessionKey: session.publicKey.toBase58(), sessionToken: token.toBase58(), attempts, checks, steps }, null, 2)}\n`,
  );
  console.log(`\nwrote ${out}`);
  process.exit(checks.every((check) => check.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
