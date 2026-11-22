/**
 * Creates the bot and AI wallets (once) and tops them up from the deployer on devnet.
 *
 *   pnpm fund --dry-run      show the keys and the plan, send nothing
 *   pnpm fund                fund the three v1 bots
 *   pnpm fund --all          fund all seven (bots v2 and the two AI analysts)
 *   pnpm fund --target 0.1   top up to 0.1 SOL each instead of 0.05
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { config as loadEnv } from "dotenv";

import { DEFAULT_TARGET, SOL, planFunding } from "./funding.js";
import { loadAll } from "./keys.js";
import { membersFor } from "./roster.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: resolve(ROOT, ".env"), quiet: true });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const target = args.includes("--target")
  ? Math.round(Number(args[args.indexOf("--target") + 1]) * SOL)
  : DEFAULT_TARGET;
const TRANSFERS_PER_TX = 8;

async function main() {
  const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const keyDir = resolve(ROOT, process.env.AGENT_KEYPAIR_DIR || ".keys/agents");
  const treasury = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(
        readFileSync(resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"), "utf8"),
      ),
    ),
  );
  const connection = new Connection(rpc, "confirmed");

  const members = loadAll(keyDir, membersFor(all ? "all" : "v1"));
  const balances = await connection.getMultipleAccountsInfo(
    members.map((m) => m.keypair.publicKey),
  );
  const wallets = members.map((m, i) => ({
    name: m.member.id,
    balance: balances[i]?.lamports ?? 0,
  }));
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  const plan = planFunding(wallets, treasuryBalance, target);

  console.log(
    `treasury  ${treasury.publicKey.toBase58()}  ${(treasuryBalance / SOL).toFixed(3)} SOL`,
  );
  for (const { member, keypair, created } of members) {
    const wallet = wallets.find((w) => w.name === member.id)!;
    console.log(
      `  ${member.id.padEnd(24)} ${keypair.publicKey.toBase58()}  ${(wallet.balance / SOL).toFixed(3)} SOL${created ? "  (new key)" : ""}`,
    );
  }
  console.log(
    `\nplan: ${plan.transfers.length} transfer(s), ${(plan.total / SOL).toFixed(3)} SOL, target ${(target / SOL).toFixed(3)} SOL each`,
  );
  for (const t of plan.transfers)
    console.log(`  + ${(t.lamports / SOL).toFixed(3)} SOL to ${t.name}`);
  for (const t of plan.short) {
    console.log(
      `  ! ${t.name} stays short by ${(t.lamports / SOL).toFixed(3)} SOL (treasury reserve)`,
    );
  }
  if (dryRun || plan.transfers.length === 0) {
    if (dryRun) console.log("\n--dry-run: nothing was sent");
    return;
  }

  const byName = new Map(members.map((m) => [m.member.id, m.keypair.publicKey]));
  for (let i = 0; i < plan.transfers.length; i += TRANSFERS_PER_TX) {
    const tx = new Transaction();
    for (const t of plan.transfers.slice(i, i + TRANSFERS_PER_TX)) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey: byName.get(t.name)!,
          lamports: t.lamports,
        }),
      );
    }
    const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
    console.log(`  sent ${signature}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
