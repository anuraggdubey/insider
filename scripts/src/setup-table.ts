/**
 * Sets up the table on devnet: creates the public accounts, creates the ten seats and delegates
 * everything to the TEE. Idempotent and resumable: it reads what exists and sends only what is
 * missing, so it is safe to run again after a failure.
 *
 *   pnpm setup-table --dry-run       print the plan, send nothing (works before the program is deployed)
 *   pnpm setup-table                 run the plan with the deployer wallet as the table authority
 *   pnpm setup-table --validator er  delegate to the public ER instead of the TEE
 *   pnpm setup-table --arm           also schedule the tick crank on the TEE once delegated
 */
import { Connection } from "@solana/web3.js";

import { teeAuthUrl } from "./lib/tee.js";

import { VALIDATORS, config, loadKeypair } from "./lib/config.js";
import { addressUrl, baseTxUrl } from "./lib/explorer.js";
import { insiderProgram, tableAccounts } from "./lib/insider.js";
import { getDelegationStatus, waitFor } from "./lib/rpc.js";
import { armCrank, needsArming } from "./setup/arm.js";
import { readState, sendBatch } from "./setup/chain.js";
import { describeTarget, isComplete, planSetup } from "./setup/plan.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const arm = args.includes("--arm");
const kind = args.includes("--validator") ? args[args.indexOf("--validator") + 1] : "tee";
if (kind !== "tee" && kind !== "er") throw new Error("--validator must be tee or er");

async function main() {
  const authority = loadKeypair(config.walletPath);
  const connection = new Connection(config.baseRpcUrl, "confirmed");
  const accounts = tableAccounts(authority.publicKey);
  const validator = VALIDATORS[kind as "tee" | "er"];

  console.log(`program    ${config.programId.toBase58()}`);
  console.log(`authority  ${authority.publicKey.toBase58()}`);
  console.log(`table      ${accounts.table.toBase58()}  ${addressUrl(accounts.table.toBase58())}`);
  console.log(`validator  ${kind} (${validator.toBase58()})`);

  const program = await connection.getAccountInfo(config.programId);
  if (!program?.executable) {
    if (!dryRun) {
      throw new Error(
        `the game program ${config.programId.toBase58()} is not deployed on devnet yet: run pnpm program:deploy first (or use --dry-run)`,
      );
    }
    console.log("note       the game program is not deployed yet; showing the full plan\n");
  }

  const state = await readState(connection, accounts);
  const plan = planSetup(state);
  if (plan.length === 0) {
    console.log("\nnothing to do: the table is created and delegated");
    return;
  }

  console.log(`\nplan: ${plan.length} transaction(s)`);
  plan.forEach((batch, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${batch.label}: ${batch.steps
        .map((s) => `${s.kind} ${describeTarget(s.target)}`)
        .join(", ")}`,
    );
  });
  if (dryRun) {
    console.log("\n--dry-run: nothing was sent");
    return;
  }

  const client = insiderProgram(connection, authority);
  for (const [i, batch] of plan.entries()) {
    const started = performance.now();
    const signature = await sendBatch(connection, client, authority, accounts, batch, validator);
    console.log(
      `  ${String(i + 1).padStart(2)}/${plan.length} ${batch.label.padEnd(34)} ${String(
        Math.round(performance.now() - started),
      ).padStart(5)}ms ${baseTxUrl(signature)}`,
    );
  }

  // the router needs a moment to learn about the delegation
  const status = await waitFor("router delegation status", async () => {
    const s = await getDelegationStatus(config.routerUrl, accounts.table);
    return s.isDelegated && s.fqdn ? s : undefined;
  });
  console.log(`\ntable is delegated and served at ${status.fqdn}`);

  const after = await readState(connection, accounts);
  if (!isComplete(after)) {
    throw new Error("setup finished but some accounts are still missing or not delegated");
  }
  console.log("setup complete");

  if (arm) await armOnRollup(status.fqdn!, authority, accounts);
}

async function armOnRollup(
  endpoint: string,
  authority: ReturnType<typeof loadKeypair>,
  accounts: ReturnType<typeof tableAccounts>,
) {
  const url = endpoint.includes("tee") ? (await teeAuthUrl(endpoint, authority)).url : endpoint;
  const rollup = new Connection(url, "confirmed");
  const client = insiderProgram(rollup, authority);
  const info = await rollup.getAccountInfo(accounts.table);
  if (!info) throw new Error("the table is not readable on the rollup yet");
  const table = client.coder.accounts.decode("table", info.data) as {
    armedUntilSlot: { toNumber(): number };
  };
  const slot = await rollup.getSlot();
  if (!needsArming(table.armedUntilSlot.toNumber(), slot)) {
    console.log("crank is already armed");
    return;
  }
  const signature = await armCrank(rollup, client, authority, accounts);
  console.log(`crank armed for 1,200 ticks (10 min): ${signature}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
