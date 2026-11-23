/**
 * The Alpha Cup operator service. It holds the table authority key, because the program needs the
 * operator to co-sign every `cup_join` and to close a paid cup.
 *
 *   pnpm cup-operator
 *
 * What it does:
 *   1. counts buy-ins: each time its private balance of the cup token rises by one buy-in, one entry
 *      may be co-signed;
 *   2. `POST /cup/cosign {transactionBase64}`: checks a seat owner's signed `cup_join`, co-signs it and
 *      submits it to the rollup (one credit each);
 *   3. when the cup is settled, pays the winners (and the platform fee) with private transfers and
 *      closes the cup so the next one can start;
 *   4. `GET /cup/status`.
 *
 * Environment: CUP_MINT (the cup token; default the G5 test mint), CUP_BUY_IN (token base units,
 * default 10,000,000 = 10 tokens), CUP_FEE_BPS (default 500 = 5%), CUP_FEE_WALLET (default the G5 fee
 * wallet), CUP_PORT (default 8789). The state lives in `.keys/cup-operator.json`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { resolve } from "node:path";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import pino from "pino";

import {
  ROOT,
  config as sdkConfig,
  cupClose,
  decodeCup,
  loadKeypair,
  sendTx,
  sleep,
  tableAccounts,
  teeAuthUrl,
  tx as buildTx,
} from "@insider/sdk/node";

import { CreditLedger, payouts, verifyJoin } from "./logic.js";
import { Payments } from "./payments.js";

const log = pino({ level: process.env.LOG_LEVEL || "info" });

type State = {
  ledger: ReturnType<CreditLedger["save"]> | null;
  /** cup id -> winner -> payout signature (so a restart never pays twice). */
  paid: Record<string, Record<string, string>>;
  feePaid: Record<string, string>;
  history: Array<{
    cup: number;
    entrants: number;
    pot: string;
    fee: string;
    prizes: Array<{ to: string; amount: string; signature: string }>;
    closed: string;
  }>;
};

const keyPath = (name: string) => resolve(ROOT, ".keys", name);
const loadPubkey = (path: string) => loadKeypair(path).publicKey;

async function main() {
  const authority = loadKeypair(resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"));
  const config = { ...sdkConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const mint = new PublicKey(
    process.env.CUP_MINT || loadPubkey(keyPath("gates/payments-mint.json")),
  );
  const feeWallet = new PublicKey(
    process.env.CUP_FEE_WALLET || loadPubkey(keyPath("gates/fee.json")),
  );
  const buyIn = BigInt(process.env.CUP_BUY_IN || 10_000_000);
  const feeBps = Number(process.env.CUP_FEE_BPS || 500);
  const port = Number(process.env.CUP_PORT || 8789);
  const statePath = keyPath("cup-operator.json");

  const payments = new Payments(config.baseRpcUrl);
  const ledger = new CreditLedger(buyIn);
  const state: State = existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, "utf8")) as State)
    : { ledger: null, paid: {}, feePaid: {}, history: [] };
  if (state.ledger) ledger.load(state.ledger);
  const persist = () => {
    state.ledger = ledger.save();
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  };

  const rollup = async () =>
    new Connection((await teeAuthUrl(config.teeRpcUrl, authority)).url, "confirmed");
  const readCup = async () => {
    const info = await (await rollup()).getAccountInfo(accounts.cup);
    return info ? decodeCup(info.data) : undefined;
  };

  // serialise everything that spends credits or money
  let busy: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = busy.then(job, job);
    busy = run.catch(() => undefined);
    return run;
  };

  const refreshCredits = async () => {
    ledger.observe(await payments.privateBalance(authority, mint));
    persist();
  };

  const cosign = (transactionBase64: string) =>
    exclusive(async () => {
      await refreshCredits();
      const check = verifyJoin(transactionBase64, config, authority.publicKey);
      if (!check.ok) return { status: 400, body: { error: check.reason } };
      const cup = await readCup();
      if (!cup || cup.settled || cup.roundsRecorded > 0) {
        return { status: 409, body: { error: "the cup is not open for entries" } };
      }
      if (!ledger.spend()) {
        return { status: 402, body: { error: "no buy-in received yet: pay the buy-in first" } };
      }
      try {
        const transaction = Transaction.from(Buffer.from(transactionBase64, "base64"));
        transaction.partialSign(authority);
        const connection = await rollup();
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
        });
        await connection.confirmTransaction(signature, "confirmed");
        persist();
        log.info(
          { owner: check.owner.toBase58(), seat: check.seat, signature },
          "cup_join co-signed",
        );
        return { status: 200, body: { signature } };
      } catch (error) {
        // the entry did not happen: give the credit back
        ledger.credits += 1;
        persist();
        return { status: 500, body: { error: String(error).slice(0, 200) } };
      }
    });

  const payAndClose = () =>
    exclusive(async () => {
      const cup = await readCup();
      if (!cup?.settled) return;
      const id = String(cup.cupId);
      const winners = cup.winners.map((w: PublicKey) => w.toBase58());
      const shares = cup.winnerBps.map(Number);
      const plan = payouts(cup.entrants, buyIn, feeBps, shares);
      state.paid[id] ??= {};
      const done: Array<{ to: string; amount: string; signature: string }> = [];
      for (const [place, winner] of winners.entries()) {
        const amount = plan.prizes[place]!;
        if (shares[place] === 0 || amount === 0n || winner === PublicKey.default.toBase58())
          continue;
        if (winner === authority.publicKey.toBase58()) {
          // the operator is itself an entrant: the prize stays where it is
          done.push({ to: winner, amount: amount.toString(), signature: "kept by the operator" });
          continue;
        }
        let signature = state.paid[id]![winner];
        if (!signature) {
          signature = await payments.transfer(authority, new PublicKey(winner), mint, amount);
          state.paid[id]![winner] = signature;
          persist();
          log.info(
            { cup: cup.cupId, place: place + 1, winner, amount: String(amount), signature },
            "prize paid",
          );
        }
        done.push({ to: winner, amount: amount.toString(), signature });
      }
      if (plan.fee > 0n && !state.feePaid[id]) {
        const signature = await payments.transfer(authority, feeWallet, mint, plan.fee);
        state.feePaid[id] = signature;
        persist();
        log.info({ cup: cup.cupId, fee: String(plan.fee), signature }, "platform fee paid");
      }
      const connection = await rollup();
      const { signature: closed } = await sendTx(
        connection,
        buildTx(cupClose(config, authority.publicKey)),
        [authority],
      );
      state.history.push({
        cup: cup.cupId,
        entrants: cup.entrants,
        pot: plan.pot.toString(),
        fee: plan.fee.toString(),
        prizes: done,
        closed,
      });
      ledger.rebase(await payments.privateBalance(authority, mint));
      persist();
      log.info({ cup: cup.cupId, closed }, "cup paid and closed: the next cup is open");
    });

  createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type");
    response.setHeader("content-type", "application/json");
    const send = (status: number, body: unknown) => {
      response.statusCode = status;
      response.end(JSON.stringify(body));
    };
    try {
      if (request.method === "OPTIONS") return send(204, {});
      if (url.pathname === "/cup/status") {
        const cup = await readCup();
        return send(200, {
          cupId: cup?.cupId,
          open: Boolean(cup && !cup.settled && cup.roundsRecorded === 0),
          roundsRecorded: cup?.roundsRecorded,
          settled: cup?.settled,
          entrants: cup?.entries.filter((e: { joined: boolean }) => e.joined).length,
          credits: ledger.credits,
          buyIn: buyIn.toString(),
          feeBps,
          mint: mint.toBase58(),
          operator: authority.publicKey.toBase58(),
          history: state.history.slice(-5),
        });
      }
      if (url.pathname === "/cup/cosign" && request.method === "POST") {
        const body = await readBody(request);
        const { transactionBase64 } = JSON.parse(body) as { transactionBase64?: string };
        if (!transactionBase64) return send(400, { error: "transactionBase64 is required" });
        const result = await cosign(transactionBase64);
        return send(result.status, result.body);
      }
      return send(404, { error: "not found" });
    } catch (error) {
      return send(500, { error: String(error).slice(0, 200) });
    }
  }).listen(port, () =>
    log.info(
      { port, mint: mint.toBase58(), buyIn: String(buyIn), feeBps },
      "cup operator listening",
    ),
  );

  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  while (!stopping) {
    try {
      await exclusive(refreshCredits);
      await payAndClose();
    } catch (error) {
      log.warn({ error: String(error).slice(0, 200) }, "operator step failed");
    }
    await sleep(3_000);
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20_000) reject(new Error("body too large"));
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
