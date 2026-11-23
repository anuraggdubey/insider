/**
 * desk-demo (A-3.1): one Call from mint to judgement on the live TEE, with privacy probes.
 *
 *   Alice  (the table authority, seat 7)  mints a 60-second Call on SOL/USD and sells a licence
 *   Bob    (seat 8)                       buys the licence, reads the Call and trades on it
 *   Carol  (seat 9)                       never bought the licence
 *
 * Checks: only Alice reads the vault at first; after the licence Bob reads it too, Carol and an
 * anonymous client never do; the oracle judges the Call at expiry (a Right Call returns the stake
 * with a 50% bonus, a Wrong one burns it) and the author's record in `Season` is updated.
 * Writes `docs/proofs/desk.json`. Needs the table set up and the bots running (they top up Desk
 * chips at the end of each round).
 *
 *   pnpm desk-demo
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Connection, type Keypair } from "@solana/web3.js";

import {
  ROOT,
  config as baseConfig,
  buyCallLicense,
  claimSeat,
  decodeCallBook,
  decodeCallVault,
  decodeSeason,
  decodeSeat,
  deskTrade,
  erTxUrl,
  loadKeypair,
  loadOrCreateKeypair,
  mintCall,
  settleCall,
  sendTx,
  sleep,
  tableAccounts,
  teeConnection,
  tx,
} from "@insider/sdk/node";

const SEATS = { alice: 7, bob: 8, carol: 9 } as const;
const STAKE = 50;
const LICENSE = 20;
const TIMEOUT_MS = 6 * 60 * 1000;
const num = (value: { toString(): string } | number) => Number(value.toString());

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const keyDir = resolve(ROOT, ".keys/sim");
  const keys: Record<"alice" | "bob" | "carol", Keypair> = {
    alice: authority,
    bob: loadOrCreateKeypair(resolve(keyDir, "bob.json")),
    carol: loadOrCreateKeypair(resolve(keyDir, "carol.json")),
  };
  const conn: Record<"alice" | "bob" | "carol" | "anonymous", Connection> = {
    alice: await teeConnection(config, keys.alice),
    bob: await teeConnection(config, keys.bob),
    carol: await teeConnection(config, keys.carol),
    anonymous: await teeConnection(config),
  };
  const steps: Array<{ what: string; signature?: string; url?: string }> = [];
  const note = (what: string, signature?: string) => {
    const url = signature ? erTxUrl(signature, config.teeRpcUrl) : undefined;
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${what}${url ? `\n               ${url}` : ""}`,
    );
    steps.push({ what, signature, url });
  };
  const send = async (who: keyof typeof keys, what: string, ...ix: Parameters<typeof tx>) => {
    const { signature, ms } = await sendTx(conn[who], tx(...ix), [keys[who]]);
    note(`${who} ${what} (${ms} ms)`, signature);
    return signature;
  };
  const seat = async (who: keyof typeof keys) => {
    const info = await conn[who].getAccountInfo(accounts.seats[SEATS[who]]!);
    if (!info) throw new Error("seat not readable");
    return decodeSeat(info.data);
  };
  const header = async () => {
    const info = await conn.alice.getAccountInfo(accounts.callBook);
    if (!info) throw new Error("call book not readable");
    return decodeCallBook(info.data).headers[SEATS.alice]!;
  };
  const deadline = Date.now() + TIMEOUT_MS;

  // 1. everyone holds their seat and has Desk chips (the bots' round end tops them up)
  for (const who of ["alice", "bob", "carol"] as const) {
    const current = await seat(who);
    if (!current.owner.equals(keys[who].publicKey)) {
      await send(
        who,
        `claims seat ${SEATS[who]}`,
        claimSeat(config, keys[who].publicKey, SEATS[who]),
      );
    }
  }
  while ((await Promise.all([seat("alice"), seat("bob")])).some((s) => num(s.deskChips) < 200)) {
    if (Date.now() > deadline)
      throw new Error("no Desk chips: are the bots running (they top seats up each round)?");
    note("waiting for the next round end to top up Desk chips");
    await sleep(10_000);
  }
  const before = {
    alice: num((await seat("alice")).deskChips),
    bob: num((await seat("bob")).deskChips),
  };

  // 2. Alice mints a Call
  await send(
    "alice",
    `mints a 60 s Call: up, stake ${STAKE}, licence ${LICENSE}`,
    mintCall(config, authority.publicKey, SEATS.alice, {
      direction: 1,
      horizon: 60,
      stake: STAKE,
      licenseAsk: LICENSE,
      confidence: 80,
    }),
  );
  const minted = await header();
  note(
    `Call ${minted.callId} minted at $${(num(minted.mintedPrice) / 1e6).toFixed(2)}, expires ${new Date(num(minted.expiryTs) * 1000).toISOString().slice(11, 19)}`,
  );

  // 3. who can read the vault
  const vault = accounts.callVaults[SEATS.alice]!;
  const reads = async () => {
    const out: Record<string, string> = {};
    for (const who of ["alice", "bob", "carol", "anonymous"] as const) {
      const info = await conn[who].getAccountInfo(vault).catch(() => null);
      out[who] = info
        ? `reads direction ${decodeCallVault(info.data).direction > 0 ? "up" : "down"}`
        : "sees nothing";
    }
    return out;
  };
  const beforeLicense = await reads();
  note(`before the licence: ${JSON.stringify(beforeLicense)}`);
  await send(
    "bob",
    `buys the licence from seat ${SEATS.alice} for ${LICENSE}`,
    buyCallLicense(config, keys.bob.publicKey, SEATS.bob, SEATS.alice),
  );
  await sleep(1_000);
  const afterLicense = await reads();
  note(`after the licence: ${JSON.stringify(afterLicense)}`);
  const afterBuy = {
    alice: num((await seat("alice")).deskChips),
    bob: num((await seat("bob")).deskChips),
  };

  // 4. Bob acts on what he read: a Desk trade at the oracle price
  const direction = decodeCallVault((await conn.bob.getAccountInfo(vault))!.data).direction;
  await send(
    "bob",
    `trades ${direction > 0 ? "+" : "-"}100 Desk units on the Call`,
    deskTrade(config, keys.bob.publicKey, SEATS.bob, direction * 100),
  );

  // 5. the oracle judges it at expiry
  let settled = false;
  while (!settled) {
    if (Date.now() > deadline) throw new Error("timed out waiting to settle");
    const h = await header();
    if (h.state !== 1) break;
    try {
      await send(
        "carol",
        "settles the Call",
        settleCall(config, keys.carol.publicKey, SEATS.alice),
      );
      settled = true;
    } catch {
      // not due yet (or the feed is a moment stale): try again in a few seconds
      await sleep(3_000);
    }
  }
  const done = await header();
  const verdict = done.state === 2 ? "Right" : "Wrong";
  const seasonInfo = await conn.alice.getAccountInfo(accounts.season);
  const stats = decodeSeason(seasonInfo!.data).analysts[SEATS.alice]!;
  const after = {
    alice: num((await seat("alice")).deskChips),
    bob: num((await seat("bob")).deskChips),
  };
  note(
    `Call judged ${verdict}: direction revealed ${num(done.revealedDir) > 0 ? "up" : "down"}; Alice's record: ${stats.calls} calls, ${stats.hits} hits, profit ${num(stats.profit)}`,
  );

  // a round end in the middle of the demo tops a seat back up to 1,000, which hides the exact amount
  const toppedUp = (...values: number[]) => values.some((value) => value === 1_000);
  const checks = [
    {
      name: "only Alice reads the vault before the licence",
      pass:
        beforeLicense.alice.startsWith("reads") &&
        beforeLicense.bob === "sees nothing" &&
        beforeLicense.carol === "sees nothing" &&
        beforeLicense.anonymous === "sees nothing",
    },
    {
      name: "after the licence Alice and Bob read it, Carol and anonymous do not",
      pass:
        afterLicense.alice.startsWith("reads") &&
        afterLicense.bob.startsWith("reads") &&
        afterLicense.carol === "sees nothing" &&
        afterLicense.anonymous === "sees nothing",
    },
    {
      name: "the licence moved its price from Bob to Alice",
      pass:
        toppedUp(afterBuy.bob, afterBuy.alice) ||
        (afterBuy.bob === before.bob - LICENSE &&
          afterBuy.alice === before.alice - STAKE + LICENSE),
    },
    {
      name: "the oracle judged the Call and revealed the direction",
      pass: (done.state === 2 || done.state === 3) && num(done.revealedDir) !== 0,
    },
    {
      name: "the stake came back with a bonus or was burned",
      // lower bounds: a round-end top-up in the middle only ever adds chips
      pass:
        verdict === "Right"
          ? after.alice >= afterBuy.alice + STAKE + STAKE / 2
          : after.alice >= afterBuy.alice,
    },
    {
      name: "Alice's public record counts the Call",
      pass: stats.calls >= 1 && (verdict === "Wrong" || stats.hits >= 1),
    },
  ];
  console.log("\nchecks");
  for (const check of checks) console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}`);

  const out = resolve(ROOT, "docs/proofs/desk.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify({ table: accounts.table.toBase58(), program: config.programId.toBase58(), verdict, mintedPrice: num(minted.mintedPrice) / 1e6, beforeLicense, afterLicense, deskChips: { before, afterBuy, after }, season: { calls: stats.calls, hits: stats.hits, profit: num(stats.profit) }, checks, steps }, null, 2)}\n`,
  );
  console.log(`\nwrote ${out}`);
  process.exit(checks.every((check) => check.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
