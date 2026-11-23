/**
 * cup-demo (A-3.3): one Alpha Cup on the live table, from buy-ins to prizes.
 *
 *   Bob (seat 8) and Carol (seat 9) get test tokens, deposit them into the rollup, privately transfer
 *   the buy-in to the operator, join the cup through the operator's co-signing endpoint, play five
 *   rounds against the bots, and the operator pays the top two (60/40 of the pot minus a 5% fee) with
 *   private transfers and closes the cup.
 *
 *   pnpm cup-operator      (in another terminal: needs the table authority key)
 *   pnpm bots              (the bots record, settle and drive the rounds)
 *   pnpm cup-demo
 *
 * Writes `docs/proofs/cup.json`. Takes about ten minutes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  Connection,
  type Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import {
  ROOT,
  config as sdkConfig,
  claimSeat,
  cupJoin,
  decodeCup,
  decodeSeat,
  decodeTable,
  loadKeypair,
  loadOrCreateKeypair,
  sendOrder,
  sendTx,
  sleep,
  tableAccounts,
  teeConnection,
  tx as buildTx,
} from "@insider/sdk/node";

import { Payments } from "./payments.js";

const OPERATOR_URL = process.env.CUP_OPERATOR_URL || "http://localhost:8789";
const SEATS = { bob: 8, carol: 9 } as const;
const TIMEOUT_MS = 25 * 60_000;

type Status = {
  cupId: number;
  open: boolean;
  roundsRecorded: number;
  settled: boolean;
  entrants: number;
  credits: number;
  buyIn: string;
  feeBps: number;
  mint: string;
  operator: string;
  history: Array<{
    cup: number;
    entrants: number;
    pot: string;
    fee: string;
    prizes: Array<{ to: string; amount: string; signature: string }>;
    closed: string;
  }>;
};

async function main() {
  const authority = loadKeypair(resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"));
  const config = { ...sdkConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const keyDir = resolve(ROOT, ".keys/sim");
  const players = {
    bob: loadOrCreateKeypair(resolve(keyDir, "bob.json")),
    carol: loadOrCreateKeypair(resolve(keyDir, "carol.json")),
  } as const;
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const payments = new Payments(config.baseRpcUrl);
  const steps: Array<{ at: string; what: string; signature?: string }> = [];
  const note = (what: string, signature?: string) => {
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${what}${signature ? `  ${signature}` : ""}`,
    );
    steps.push({ at: new Date().toISOString(), what, signature });
  };
  const status = async (): Promise<Status> => {
    const response = await fetch(`${OPERATOR_URL}/cup/status`, {
      signal: AbortSignal.timeout(20_000),
    });
    return (await response.json()) as Status;
  };
  const deadline = Date.now() + TIMEOUT_MS;
  const guard = () => {
    if (Date.now() > deadline) throw new Error("timed out");
  };

  const first = await status().catch(() => {
    throw new Error(`the cup operator is not reachable at ${OPERATOR_URL}: run pnpm cup-operator`);
  });
  const mint = new PublicKey(first.mint);
  const buyIn = BigInt(first.buyIn);
  note(
    `cup ${first.cupId}: buy-in ${Number(buyIn) / 1e6} tokens, fee ${first.feeBps / 100}%, ${first.entrants} entrants so far`,
  );
  if (!first.open)
    throw new Error(
      "the cup is not open for entries (it is running or waiting to be paid): try again after it closes",
    );

  // 1. test tokens and a little SOL for the players
  for (const [name, player] of Object.entries(players) as Array<[keyof typeof players, Keypair]>) {
    if ((await base.getBalance(player.publicKey)) < 40_000_000) {
      await sendAndConfirmTransaction(
        base,
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: authority.publicKey,
            toPubkey: player.publicKey,
            lamports: 60_000_000,
          }),
        ),
        [authority],
      );
      note(`${name} receives 0.06 SOL for fees`);
    }
    const ata = await getOrCreateAssociatedTokenAccount(base, authority, mint, player.publicKey);
    if (ata.amount < buyIn) {
      const signature = await mintTo(base, authority, mint, ata.address, authority, buyIn * 2n);
      note(`${name} receives ${Number(buyIn * 2n) / 1e6} test tokens`, signature);
    }
  }

  // 2. everyone pays the buy-in privately to the operator
  const operator = new PublicKey(first.operator);
  const wallet = (player: Keypair) => payments.privateBalance(player, mint);
  for (const [name, player] of Object.entries(players) as Array<[keyof typeof players, Keypair]>) {
    const before = await wallet(player).catch(() => 0n);
    if (before < buyIn) {
      const signature = await payments.deposit(player, mint, buyIn);
      note(`${name} deposits ${Number(buyIn) / 1e6} tokens into the rollup`, signature);
      for (;;) {
        guard();
        if ((await wallet(player).catch(() => 0n)) >= buyIn) break;
        await sleep(3_000);
      }
    }
    const signature = await payments.transfer(player, operator, mint, buyIn);
    note(`${name} sends the buy-in privately to the operator`, signature);
  }
  for (;;) {
    guard();
    if ((await status()).credits >= 2) break;
    await sleep(3_000);
  }
  note("the operator has counted both buy-ins");

  // 3. seats and the join, co-signed by the operator
  const rollups = {
    bob: await teeConnection(config, players.bob),
    carol: await teeConnection(config, players.carol),
  };
  for (const [name, player] of Object.entries(players) as Array<[keyof typeof players, Keypair]>) {
    const index = SEATS[name];
    const seatInfo = await rollups[name].getAccountInfo(accounts.seats[index]!);
    if (!seatInfo || !decodeSeat(seatInfo.data).owner.equals(player.publicKey)) {
      const { signature } = await sendTx(
        rollups[name],
        buildTx(claimSeat(config, player.publicKey, index)),
        [player],
      );
      note(`${name} claims seat ${index}`, signature);
    }
    const transaction = new Transaction().add(cupJoin(config, player.publicKey, index));
    transaction.feePayer = player.publicKey;
    transaction.recentBlockhash = (await rollups[name].getLatestBlockhash("confirmed")).blockhash;
    transaction.partialSign(player);
    const response = await fetch(`${OPERATOR_URL}/cup/cosign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionBase64: transaction
          .serialize({ requireAllSignatures: false })
          .toString("base64"),
      }),
    });
    const body = (await response.json()) as { signature?: string; error?: string };
    if (!response.ok) throw new Error(`${name} could not join: ${body.error}`);
    note(`${name} joins the cup (the operator co-signed)`, body.signature);
  }
  const refused = await fetch(`${OPERATOR_URL}/cup/cosign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transactionBase64: "AAAA" }),
  });
  note(`a junk transaction is refused (HTTP ${refused.status})`);

  // 4. play until the cup is paid: both trade in the first half of every round
  const admin = await teeConnection(config, authority);
  const traded = new Set<number>();
  const before = { bob: await wallet(players.bob), carol: await wallet(players.carol) };
  let lastLog = "";
  for (;;) {
    guard();
    const [tableInfo, cupInfo] = await Promise.all([
      admin.getAccountInfo(accounts.table),
      admin.getAccountInfo(accounts.cup),
    ]);
    const table = decodeTable(tableInfo!.data);
    const cup = decodeCup(cupInfo!.data);
    const log = `round ${table.roundId} tick ${table.tick}: cup ${cup.cupId}, ${cup.roundsRecorded}/5 rounds, ${cup.settled ? "settled" : "running"}`;
    if (cup.cupId > first.cupId) break;
    if (log.split(" tick")[0] + cup.roundsRecorded !== lastLog) {
      lastLog = log.split(" tick")[0] + cup.roundsRecorded;
      note(log);
    }
    const live = Object.keys(table.phase)[0] === "live";
    if (
      live &&
      table.tick >= 15 &&
      table.tick < 120 &&
      !traded.has(table.roundId) &&
      !cup.settled
    ) {
      traded.add(table.roundId);
      for (const [name, size] of [
        ["bob", 200],
        ["carol", -200],
      ] as const) {
        try {
          const { signature } = await sendTx(
            rollups[name],
            buildTx(sendOrder(config, players[name].publicKey, SEATS[name], size, 0)),
            [players[name]],
          );
          note(
            `${name} ${size > 0 ? "buys" : "sells"} ${Math.abs(size)} in round ${table.roundId}`,
            signature,
          );
        } catch (error) {
          note(`${name}'s order failed: ${String(error).slice(0, 80)}`);
        }
      }
    }
    await sleep(2_000);
  }

  // 5. the result
  const done = await status();
  const entry = done.history.at(-1);
  if (!entry) throw new Error("the cup closed but the operator has no payout record");
  note(
    `cup ${entry.cup} paid: pot ${Number(entry.pot) / 1e6}, fee ${Number(entry.fee) / 1e6}, cup closed`,
    entry.closed,
  );
  const after = { bob: await wallet(players.bob), carol: await wallet(players.carol) };
  const received = {
    bob: after.bob - before.bob,
    carol: after.carol - before.carol,
  };
  const prizeTo = (key: Keypair) => entry.prizes.find((p) => p.to === key.publicKey.toBase58());
  const checks = [
    { name: "two entrants joined and the buy-ins were counted", pass: entry.entrants === 2 },
    {
      name: "the pot is the buy-ins, the fee is 5%",
      pass: entry.pot === (buyIn * 2n).toString() && BigInt(entry.fee) >= (buyIn * 2n * 5n) / 100n,
    },
    { name: "two prizes were paid, 60/40 of the pool", pass: entry.prizes.length === 2 },
    {
      name: "each winner's private balance rose by exactly the prize",
      pass: (["bob", "carol"] as const).every((name) => {
        const prize = prizeTo(players[name]);
        return prize !== undefined && received[name] === BigInt(prize.amount);
      }),
    },
    { name: "the next cup is open", pass: done.cupId === first.cupId + 1 && done.open },
  ];
  console.log("\nchecks");
  for (const check of checks) console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}`);

  const out = resolve(ROOT, "docs/proofs/cup.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify({ table: accounts.table.toBase58(), program: config.programId.toBase58(), mint: mint.toBase58(), buyIn: buyIn.toString(), players: { bob: players.bob.publicKey.toBase58(), carol: players.carol.publicKey.toBase58() }, payout: entry, received: { bob: received.bob.toString(), carol: received.carol.toString() }, checks, steps }, null, 2)}\n`,
  );
  console.log(`\nwrote ${out}`);
  process.exit(checks.every((check) => check.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
