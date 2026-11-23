/**
 * simulate-round (A-2.2): one scripted round on the live TEE with three keys.
 *
 *   Alice  (the table authority, seat 7)  buys and opens Leaks, then front-runs on the priority lane
 *   Bob    (seat 8)                       the victim: one large standard-lane order
 *   Carol  (seat 9)                       buys and opens a different Leak
 *
 * It requests the seed, waits for the eight drops, makes the three actors play, scores and reseals
 * the round, then reads the X-ray and checks the proof rules (`sim/checks.ts`). Along the way it
 * probes privacy: Bob and an anonymous client try to read Alice's opened vault. Every transaction
 * is printed with its explorer link and the whole run is written to `docs/proofs/simulate-round.json`.
 *
 *   pnpm simulate-round              run it (stop the bots first, or they join the round)
 *
 * Needs the table set up and the crank armed (`pnpm setup-table --arm`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Connection, Keypair, type TransactionInstruction } from "@solana/web3.js";

import {
  ROOT,
  config as baseConfig,
  bid,
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
  teeAuthUrl,
  tx,
} from "@insider/sdk/node";

import { cycleStateFrom, nextAction } from "./round/cycle.js";
import { evaluate, type XrayView } from "./sim/checks.js";

const SEATS = { alice: 7, bob: 8, carol: 9 } as const;
/** Most a Leak may cost the actors, in chips (bankroll is 1,000). */
const MAX_PRICE = 25;
const BOB_SIZE = 600;
const ALICE_SIZE = 400;
const TIMEOUT_MS = 6 * 60 * 1000;

type Actor = { name: "alice" | "bob" | "carol"; seat: number; key: Keypair; rollup: Connection };
type Step = {
  at: string;
  actor?: string;
  what: string;
  signature?: string;
  url?: string;
  detail?: unknown;
};

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const keyDir = resolve(ROOT, ".keys/sim");
  const keys = {
    alice: authority,
    bob: loadOrCreateKeypair(resolve(keyDir, "bob.json")),
    carol: loadOrCreateKeypair(resolve(keyDir, "carol.json")),
  };

  const connect = async (key: Keypair) =>
    new Connection((await teeAuthUrl(config.teeRpcUrl, key)).url, "confirmed");
  const actors: Record<Actor["name"], Actor> = {
    alice: { name: "alice", seat: SEATS.alice, key: keys.alice, rollup: await connect(keys.alice) },
    bob: { name: "bob", seat: SEATS.bob, key: keys.bob, rollup: await connect(keys.bob) },
    carol: { name: "carol", seat: SEATS.carol, key: keys.carol, rollup: await connect(keys.carol) },
  };
  const anonymous = new Connection(config.teeRpcUrl, "confirmed");

  const steps: Step[] = [];
  const log = (what: string, extra: Partial<Step> = {}) => {
    const who = extra.actor ? `${extra.actor.padEnd(5)} ` : "      ";
    console.log(`${new Date().toISOString().slice(11, 23)}  ${who}${what}`);
    if (extra.url) console.log(`               ${extra.url}`);
    steps.push({ at: new Date().toISOString(), what, ...extra });
  };
  const send = async (actor: Actor, what: string, ...ix: TransactionInstruction[]) => {
    const { signature, ms } = await sendTx(actor.rollup, tx(...ix), [actor.key]);
    log(`${what} (${ms} ms)`, {
      actor: actor.name,
      signature,
      url: erTxUrl(signature, config.teeRpcUrl),
    });
    return signature;
  };

  const read = async () => {
    const [table, board, xray, slot] = await Promise.all([
      actors.alice.rollup.getAccountInfo(accounts.table),
      actors.alice.rollup.getAccountInfo(accounts.board),
      actors.alice.rollup.getAccountInfo(accounts.xray),
      actors.alice.rollup.getSlot(),
    ]);
    if (!table || !board || !xray) throw new Error("the table is not readable on the TEE");
    const t = decodeTable(table.data);
    const b = decodeBoard(board.data);
    const x = decodeXray(xray.data);
    return { t, b, x, state: cycleStateFrom(t, b, x, slot) };
  };

  // 1. start a round: score and reseal whatever is left over, then ask for a seed
  log(
    `table ${accounts.table.toBase58()}, actors: alice ${keys.alice.publicKey.toBase58()}, bob ${keys.bob.publicKey.toBase58()}, carol ${keys.carol.publicKey.toBase58()}`,
  );
  const deadline = Date.now() + TIMEOUT_MS;
  let requested = false;
  while (!requested) {
    if (Date.now() > deadline) throw new Error("timed out waiting for a round to start");
    const { state } = await read();
    const action = nextAction(state);
    if (action === "wait") await sleep(500);
    else if (action === "finish_round")
      await send(
        actors.alice,
        "finish_round (previous round)",
        finishRound(config, authority.publicKey),
      );
    else if (action === "reseal_leaks")
      await send(
        actors.alice,
        "reseal_leaks (previous round)",
        resealLeaks(config, authority.publicKey, 0, 6),
      );
    else if (action === "cancel_vrf")
      await send(
        actors.alice,
        "cancel_vrf",
        (await import("@insider/sdk/node")).cancelVrf(config, authority.publicKey),
      );
    else if (action === "request_round_seed") {
      await send(actors.alice, "request_round_seed", requestRoundSeed(config, authority.publicKey));
      requested = true;
    } else throw new Error(`unsupported action ${action}`);
  }

  // 2. wait for Live, then everyone sits down
  let round = 0;
  for (;;) {
    if (Date.now() > deadline) throw new Error("the round never went live");
    const { state } = await read();
    if (state.phase === "live") {
      round = state.roundId;
      break;
    }
    await sleep(500);
  }
  log(`round ${round} is live`);
  for (const actor of Object.values(actors)) {
    await send(
      actor,
      `claim seat ${actor.seat}`,
      claimSeat(config, actor.key.publicKey, actor.seat),
    );
  }

  // 3. play: Bob sends once the first drop is out; Alice and Carol buy, open and read; Alice front-runs
  const bought = { alice: 0, carol: 0 };
  const opened = new Set<number>();
  const read_: Record<string, boolean> = {};
  let bobSent = false;
  let aliceFired = false;
  let privacy: unknown;
  const bobLeakIds = new Set<number>();
  let lastTick = -1;

  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out during the round");
    const { t, b, state } = await read();
    if (state.phase === "xray" || state.phase === "idle" || t.roundId !== round) break;
    if (t.tick !== lastTick && t.tick % 20 === 0) {
      lastTick = t.tick;
      log(`tick ${t.tick}`);
    }
    const headers = b.headers.map((h, slot) => ({ ...h, slot }));
    const live = state.phase === "live";

    if (live && !bobSent && headers.some((h) => h.state === 1)) {
      bobSent = true;
      await send(
        actors.bob,
        `order: buy ${BOB_SIZE} on the standard lane`,
        sendOrder(config, keys.bob.publicKey, SEATS.bob, BOB_SIZE, 0),
      );
    }

    for (const who of ["alice", "carol"] as const) {
      const actor = actors[who];
      // buy: the first cheap auction no one holds, at most two per actor
      const unopened = headers.filter(
        (h) => h.ownerSeat === actor.seat && (h.state === 2 || h.state === 3),
      ).length;
      const target = headers.find((h) => h.state === 1 && !bobLeakIds.has(h.leakId));
      if (
        live &&
        (who === "alice" ? bobSent : true) &&
        target &&
        unopened < 2 &&
        bought[who] < 2 &&
        target.startPrice <= MAX_PRICE * 2
      ) {
        try {
          await send(
            actor,
            `bid on slot ${target.slot} (kind ${target.kind})`,
            bid(config, actor.key.publicKey, actor.seat, target.slot),
          );
          bought[who] += 1;
          bobLeakIds.add(target.leakId);
        } catch (error) {
          log(`bid skipped: ${String(error).slice(0, 80)}`, { actor: who });
        }
      }
      // open what it owns
      for (const h of headers.filter((x) => x.ownerSeat === actor.seat && x.state === 2)) {
        await send(
          actor,
          `open slot ${h.slot}`,
          openLeak(config, actor.key.publicKey, actor.seat, h.slot),
        );
        opened.add(h.leakId);
      }
    }

    // privacy probes on Alice's first opened vault, then Alice reads and front-runs
    const aliceOpened = headers.find((h) => h.ownerSeat === SEATS.alice && h.state === 4);
    if (aliceOpened && !read_.probe) {
      read_.probe = true;
      const vaultKey = accounts.leakVaults[aliceOpened.slot]!;
      const [asAlice, asBob, asAnonymous] = await Promise.all([
        actors.alice.rollup.getAccountInfo(vaultKey),
        actors.bob.rollup.getAccountInfo(vaultKey),
        anonymous.getAccountInfo(vaultKey),
      ]);
      privacy = {
        vault: vaultKey.toBase58(),
        aliceCanRead: Boolean(asAlice),
        bobCanRead: Boolean(asBob),
        anonymousCanRead: Boolean(asAnonymous),
      };
      log(
        `privacy: Alice reads her vault ${asAlice ? "yes" : "NO"}, Bob ${asBob ? "READS IT" : "sees nothing"}, anonymous ${asAnonymous ? "READS IT" : "sees nothing"}`,
        { detail: privacy },
      );
      const vault = asAlice ? decodeLeakVault(asAlice.data) : undefined;
      if (vault)
        log(
          `Alice's payload: kind ${vault.kind}, ${vault.orderCount} order(s), fields ${[...vault.fields].join(",")}`,
          { actor: "alice" },
        );
    }
    if (live && bobSent && !aliceFired && aliceOpened) {
      aliceFired = true;
      await send(
        actors.alice,
        `front-run: buy ${ALICE_SIZE} on the priority lane`,
        sendOrder(config, authority.publicKey, SEATS.alice, ALICE_SIZE, 1),
      );
    }
    await sleep(500);
  }

  // 4. score and reseal (the same two steps every seat runs), then read the X-ray
  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out closing the round");
    const { state } = await read();
    const action = nextAction(state);
    if (action === "finish_round")
      await send(actors.alice, "finish_round", finishRound(config, authority.publicKey));
    else if (action === "reseal_leaks")
      await send(
        actors.alice,
        "reseal_leaks(0, 6)",
        resealLeaks(config, authority.publicKey, 0, 6),
      );
    else if (action === "wait" || action === "request_round_seed") {
      if (state.xrayFinalized && state.readers === 0) break;
      await sleep(500);
    } else await sleep(500);
  }
  const { x } = await read();
  const view: XrayView = {
    roundId: x.roundId,
    finalized: x.finalized !== 0,
    orders: x.orders.slice(0, x.orderCount).map((o) => ({
      seat: o.seat,
      lane: o.lane,
      sideSize: o.sideSize,
      sentTick: o.sentTick,
      landTick: o.landTick,
    })),
    leaks: x.leaks.slice(0, x.leakCount).map((l) => ({
      state: l.header.state,
      readerCount: l.header.readerCount,
      ownerSeat: l.header.ownerSeat,
    })),
    tagCount: x.tagCount,
  };
  const checks = evaluate(view, { alice: SEATS.alice, bob: SEATS.bob, carol: SEATS.carol }, round);
  console.log("\nX-ray checks");
  for (const check of checks)
    console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
  console.log(`  sandwich tags recorded by the program: ${x.tagCount}`);

  const out = resolve(ROOT, "docs/proofs/simulate-round.json");
  mkdirSync(dirname(out), { recursive: true });
  const summary = {
    table: accounts.table.toBase58(),
    program: config.programId.toBase58(),
    round,
    actors: Object.fromEntries(
      Object.entries(keys).map(([name, key]) => [name, key.publicKey.toBase58()]),
    ),
    checks,
    privacy,
    xray: { orders: view.orders, leaks: view.leaks, sandwichTags: x.tagCount },
    steps,
  };
  writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nwrote ${out}`);
  if (checks.some((check) => !check.pass)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
