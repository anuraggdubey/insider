/**
 * go-live (A-2.5): proves the table runs by itself with the bots. A human seat joins, plays, and the
 * script only watches: it never sends `finish_round`, `reseal_leaks`, `request_round_seed` or
 * `rearm_ticks`. The run passes when one full round (seed, play, score, reseal) completes and the
 * next one has been seeded, all by the bots. Start the bots first (`pnpm bots`).
 *
 *   pnpm go-live              watch one full round and write docs/proofs/go-live.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Connection } from "@solana/web3.js";

import {
  ROOT,
  config as baseConfig,
  claimSeat,
  decodeSeat,
  decodeTable,
  decodeXray,
  erTxUrl,
  loadKeypair,
  sendOrder,
  sendTx,
  sleep,
  tableAccounts,
  teeAuthUrl,
  tx,
} from "@insider/sdk/node";

import { phaseOf } from "./round/cycle.js";

const HUMAN_SEAT = 7;
const BOT_SEATS = [0, 1, 2];
const TIMEOUT_MS = 8 * 60 * 1000;

async function main() {
  const human = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: human.publicKey };
  const accounts = tableAccounts(human.publicKey, config.programId);
  const rollup = new Connection((await teeAuthUrl(config.teeRpcUrl, human)).url, "confirmed");
  const events: Array<{ at: string; what: string; url?: string }> = [];
  const log = (what: string, signature?: string) => {
    const url = signature ? erTxUrl(signature, config.teeRpcUrl) : undefined;
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${what}${url ? `\n               ${url}` : ""}`,
    );
    events.push({ at: new Date().toISOString(), what, url });
  };

  const snapshot = async () => {
    const [table, xray, ...seats] = await Promise.all([
      rollup.getAccountInfo(accounts.table),
      rollup.getAccountInfo(accounts.xray),
      ...BOT_SEATS.map((i) => rollup.getAccountInfo(accounts.seats[i]!)),
    ]);
    if (!table || !xray) throw new Error("the table is not readable on the TEE");
    return {
      t: decodeTable(table.data),
      x: decodeXray(xray.data),
      botOwners: seats.map((s) => (s ? decodeSeat(s.data).owner.toBase58() : "")),
    };
  };

  const deadline = Date.now() + TIMEOUT_MS;
  const first = await snapshot();
  const noBots = first.botOwners.every((owner) => owner === "11111111111111111111111111111111");
  log(`table ${accounts.table.toBase58()} round ${first.t.roundId} (${phaseOf(first.t.phase)})`);
  if (noBots) log("note: no bot has claimed a seat yet; start the bots with pnpm bots");

  // wait for a round that is Live from its start, so the whole round is watched
  let watched = 0;
  let lastTick = -1;
  let seated = false;
  let ordersSent = 0;
  let finished = false;
  let nextSeeded = false;
  let prevRound = first.t.roundId;
  while (!nextSeeded) {
    if (Date.now() > deadline) {
      throw new Error("timed out: is `pnpm bots` running and is the crank armed?");
    }
    const { t, x, botOwners } = await snapshot();
    const phase = phaseOf(t.phase);

    if (phase === "live" && watched === 0 && t.tick <= 30) {
      watched = t.roundId;
      log(`watching round ${watched} from tick ${t.tick}`);
    }
    if (watched && t.roundId === watched && phase === "live") {
      if (!seated) {
        seated = true;
        const { signature } = await sendTx(
          rollup,
          tx(claimSeat(config, human.publicKey, HUMAN_SEAT)),
          [human],
        );
        log(`human claims seat ${HUMAN_SEAT}`, signature);
      }
      if (seated && t.tick >= 10 && ordersSent < 3 && t.tick >= 10 + ordersSent * 25) {
        ordersSent += 1;
        const side = ordersSent % 2 ? 1 : -1;
        const { signature } = await sendTx(
          rollup,
          tx(sendOrder(config, human.publicKey, HUMAN_SEAT, side * 120, 0)),
          [human],
        );
        log(`human order ${ordersSent}: ${side > 0 ? "buy" : "sell"} 120`, signature);
      }
    }
    if (t.tick !== lastTick && t.tick % 50 === 0 && phase === "live") {
      lastTick = t.tick;
      log(
        `round ${t.roundId} tick ${t.tick}, bots in seats: ${botOwners.filter((o) => o !== "11111111111111111111111111111111").length}/3`,
      );
    }
    if (watched && !finished && x.roundId === watched && x.finalized !== 0) {
      finished = true;
      log(
        `round ${watched} scored by the bots: ${x.orderCount} orders, ${x.leakCount} leaks, ${x.tagCount} sandwich tag(s)`,
      );
    }
    if (watched && finished && t.roundId > watched && phase === "live") {
      nextSeeded = true;
      log(`round ${t.roundId} was seeded and is live: the loop runs by itself`);
    }
    prevRound = t.roundId;
    await sleep(1_000);
  }

  const end = await snapshot();
  const out = resolve(ROOT, "docs/proofs/go-live.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        table: accounts.table.toBase58(),
        program: config.programId.toBase58(),
        tableAuthority: human.publicKey.toBase58(),
        watchedRound: watched,
        lastRound: prevRound,
        botSeatOwners: end.botOwners,
        humanOrders: ordersSent,
        events,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\ngo live: PASS. ${ordersSent} human orders, bots drove the round; wrote ${out}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
