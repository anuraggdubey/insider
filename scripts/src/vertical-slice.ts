/**
 * The vertical slice (A-1.6): one empty-table round on the live TEE with no manual steps.
 *
 *   request_round_seed -> VRF callback (begin_round) -> Live -> 200 ticks of engine::step
 *   -> finish_round -> reseal_leaks(0, 6) -> ready for the next seed
 *
 *   pnpm vertical-slice                 one round, the authority sits in seat 7 and sends one order
 *   pnpm vertical-slice --rounds 2      several rounds back to back
 *   pnpm vertical-slice --no-order      leave the table empty
 *
 * Needs the table set up and the crank armed: `pnpm setup-table --arm`. Writes
 * `docs/proofs/vertical-slice.json`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Connection } from "@solana/web3.js";

import {
  ROOT,
  cancelVrf,
  claimSeat,
  config as baseConfig,
  decodeBoard,
  decodeTable,
  decodeXray,
  finishRound,
  loadKeypair,
  requestRoundSeed,
  resealLeaks,
  sendOrder,
  sendTx,
  sleep,
  tableAccounts,
  tx,
} from "@insider/sdk/node";

import { teeAuthUrl } from "./lib/tee.js";
import { type Action, cycleStateFrom, nextAction } from "./round/cycle.js";

const args = process.argv.slice(2);
const rounds = args.includes("--rounds") ? Number(args[args.indexOf("--rounds") + 1]) : 1;
const withOrder = !args.includes("--no-order");
if (!Number.isInteger(rounds) || rounds < 1) throw new Error("--rounds must be a positive integer");

const SEAT = 7;
const TICK_MS = 500;

type Step = { at: string; what: string; signature?: string; detail?: unknown };

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const url = (await teeAuthUrl(config.teeRpcUrl, authority)).url;
  const rollup = new Connection(url, "confirmed");
  const steps: Step[] = [];
  const log = (what: string, extra: Partial<Step> = {}) => {
    const line = `${new Date().toISOString().slice(11, 23)}  ${what}`;
    console.log(extra.signature ? `${line}  ${extra.signature}` : line);
    steps.push({ at: new Date().toISOString(), what, ...extra });
  };
  const send = async (what: string, ...ix: Parameters<typeof tx>) => {
    const { signature, ms } = await sendTx(rollup, tx(...ix), [authority]);
    log(`${what} (${ms} ms)`, { signature });
    return signature;
  };

  const read = async () => {
    const [table, board, xray, slot] = await Promise.all([
      rollup.getAccountInfo(accounts.table),
      rollup.getAccountInfo(accounts.board),
      rollup.getAccountInfo(accounts.xray),
      rollup.getSlot(),
    ]);
    if (!table || !board || !xray) throw new Error("the table is not readable on the TEE");
    const t = decodeTable(table.data);
    const state = cycleStateFrom(t, decodeBoard(board.data), decodeXray(xray.data), slot);
    return { t, state, slot };
  };

  const first = await read();
  log(`table ${accounts.table.toBase58()} round ${first.t.roundId} phase ${first.state.phase}`);

  let completed = 0;
  let ordered = false;
  let awaiting = false;
  let lastTick = -1;
  const started = Date.now();
  while (completed < rounds) {
    if (Date.now() - started > (rounds * 260 + 120) * 1000) throw new Error("timed out");
    const { t, state } = await read();
    const action: Action = nextAction(state);

    if (state.phase === "live" && t.tick !== lastTick && t.tick % 20 === 0) {
      lastTick = t.tick;
      log(`round ${t.roundId} tick ${t.tick}`);
    }
    if (state.phase === "live" && withOrder && !ordered && t.tick >= 5) {
      ordered = true;
      await send(`seat ${SEAT} claimed`, claimSeat(config, authority.publicKey, SEAT));
      await send(`order sent: buy 100 on the standard lane`, sendOrder(config, authority.publicKey, SEAT, 100, 0));
    }

    switch (action) {
      case "wait":
        await sleep(TICK_MS);
        break;
      case "request_round_seed":
        if (awaiting) {
          awaiting = false;
          completed += 1;
          log(`round ${state.roundId} complete: scored and resealed`);
          if (completed >= rounds) break;
        }
        ordered = false;
        await send("request_round_seed", requestRoundSeed(config, authority.publicKey));
        awaiting = true;
        await sleep(1_500);
        break;
      case "finish_round":
        await send(`finish_round (round ${state.roundId})`, finishRound(config, authority.publicKey));
        break;
      case "reseal_leaks":
        await send("reseal_leaks(0, 6)", resealLeaks(config, authority.publicKey, 0, 6));
        break;
      case "cancel_vrf":
        await send("cancel_vrf (the seed never came back)", cancelVrf(config, authority.publicKey));
        break;
      case "commit_epoch":
        throw new Error("commit_epoch is not implemented yet (A-3.2)");
    }
  }

  const done = await read();
  const xrayInfo = await rollup.getAccountInfo(accounts.xray);
  const xray = decodeXray(xrayInfo!.data);
  const summary = {
    table: accounts.table.toBase58(),
    program: config.programId.toBase58(),
    rounds: done.t.roundId,
    xray: {
      round: xray.roundId,
      orders: xray.orderCount,
      leaks: xray.leakCount,
      finalized: xray.finalized !== 0,
    },
    steps,
  };
  const out = resolve(ROOT, "docs/proofs/vertical-slice.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nvertical slice complete: ${rounds} round(s); wrote ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
