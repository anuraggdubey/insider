/**
 * Takes the whole table back to the base layer: commit-and-undelegate in small groups, the table
 * last. Use it to recover from a bad state, move the table or redeploy the setup.
 *
 *   pnpm teardown --dry-run     show which accounts are delegated and the groups, send nothing
 *   pnpm teardown               run it (stop the bots and the operators first)
 *   pnpm teardown --force       ignore the round phase (a stuck table that is not Idle)
 *
 * Afterwards `pnpm setup-table --arm` delegates everything again. Writes `docs/proofs/teardown.json`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Connection } from "@solana/web3.js";

import {
  MAX_TEARDOWN_GROUP,
  RECOVERY_KIND,
  ROOT,
  allRecoveryTargets,
  config as baseConfig,
  decodeTable,
  loadKeypair,
  recoveryAddress,
  sendTx,
  sleep,
  teardown,
  teeConnection,
  tx,
  type RecoveryTarget,
} from "@insider/sdk/node";

import { DELEGATION_PROGRAM_ID } from "./lib/config.js";

/**
 * One teardown intent carries about 1.7 KB of account data on the TEE: four leak vaults (1.2 KB) or
 * the two markets (1.7 KB) pass, six vaults (1.8 KB) are refused (`0xa0000002`), while a single large
 * account such as the 7 KB X-ray goes through alone. Groups therefore stop at 1.5 KB or eight accounts.
 */
export const GROUP_BYTES = 1_500;

export type Sized = { target: RecoveryTarget; size: number };

/**
 * Groups for the delegated accounts: at most eight and 1.5 KB each (a bigger account goes alone), the
 * table last (in the last group if it fits, otherwise alone).
 */
export function planGroups(delegated: Sized[], budget = GROUP_BYTES): RecoveryTarget[][] {
  const table = delegated.find((item) => item.target.kind === RECOVERY_KIND.table);
  const others = delegated.filter((item) => item.target.kind !== RECOVERY_KIND.table);
  const groups: Array<{ items: Sized[]; bytes: number }> = [];
  const place = (item: Sized) => {
    const last = groups.at(-1);
    if (last && last.items.length < MAX_TEARDOWN_GROUP && last.bytes + item.size <= budget) {
      last.items.push(item);
      last.bytes += item.size;
    } else {
      groups.push({ items: [item], bytes: item.size });
    }
  };
  others.forEach(place);
  if (table) place(table);
  return groups.map((group) => group.items.map((item) => item.target));
}

const label = (target: RecoveryTarget) => {
  const name = Object.entries(RECOVERY_KIND).find(([, kind]) => kind === target.kind)?.[0] ?? "?";
  return [
    RECOVERY_KIND.market,
    RECOVERY_KIND.leakVault,
    RECOVERY_KIND.callVault,
    RECOVERY_KIND.seat,
  ].some((kind) => kind === target.kind)
    ? `${name} ${target.slot}`
    : name;
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const base = new Connection(config.baseRpcUrl, "confirmed");

  const targets = allRecoveryTargets();
  const addresses = targets.map((target) => recoveryAddress(config, target));
  const delegatedNow = async (): Promise<Sized[]> => {
    const infos = await base.getMultipleAccountsInfo(addresses);
    return targets.flatMap((target, i) =>
      infos[i]?.owner.equals(DELEGATION_PROGRAM_ID)
        ? [{ target, size: infos[i]!.data.length }]
        : [],
    );
  };
  const delegated = await delegatedNow();
  console.log(`table ${addresses.at(-1)!.toBase58()}`);
  console.log(`${delegated.length} of ${targets.length} accounts are delegated`);
  const groups = planGroups(delegated);
  groups.forEach((group, i) => console.log(`  group ${i + 1}: ${group.map(label).join(", ")}`));
  if (dryRun || delegated.length === 0) {
    console.log(dryRun ? "\n--dry-run: nothing was sent" : "\nnothing to do");
    return;
  }

  const rollup = await teeConnection(config, authority);
  if (!force) {
    // the table must be idle: stop the bots first, or it starts the next round straight away
    const deadline = Date.now() + 120_000;
    for (;;) {
      const info = await rollup.getAccountInfo(addresses.at(-1)!);
      const phase = info ? Object.keys(decodeTable(info.data).phase)[0] : "missing";
      if (phase === "idle") break;
      if (Date.now() > deadline) {
        throw new Error(
          `the table is ${phase}, not idle: stop pnpm bots and pnpm cup-operator first (or use --force)`,
        );
      }
      console.log(`waiting for the table to go idle (it is ${phase})`);
      await sleep(5_000);
    }
  }

  const steps: Array<{ group: number; accounts: string[]; signature: string; ms: number }> = [];
  // The TEE refuses an intent whose commit does not fit one base-layer transaction (error
  // `0xa0000002`, nothing is sent). That depends on how much each account changed, which cannot be
  // known up front, so a refused group is split in two and tried again, down to single accounts (every
  // account passes alone). The table stays last because the halves keep their order.
  const send = async (group: RecoveryTarget[]): Promise<void> => {
    let sent: { signature: string; ms: number };
    try {
      sent = await sendTx(rollup, tx(teardown(config, authority.publicKey, group, force)), [
        authority,
      ]);
    } catch (error) {
      if (group.length === 1 || !String(error).includes("0xa0000002")) throw error;
      const half = Math.ceil(group.length / 2);
      console.log(`  ${group.length} accounts were too big for one intent: splitting`);
      await send(group.slice(0, half));
      await send(group.slice(half));
      return;
    }
    console.log(`  group of ${group.length} sent (${sent.ms} ms) ${sent.signature}`);
    // wait until the base layer owns them again
    const keys = group.map((target) => recoveryAddress(config, target));
    const deadline = Date.now() + 120_000;
    for (;;) {
      const infos = await base.getMultipleAccountsInfo(keys);
      if (infos.every((info) => info && !info.owner.equals(DELEGATION_PROGRAM_ID))) break;
      if (Date.now() > deadline)
        throw new Error("a group did not come back to the base layer in time");
      await sleep(2_000);
    }
    steps.push({ group: steps.length + 1, accounts: group.map(label), ...sent });
  };
  for (const group of groups) await send(group);

  const left = await delegatedNow();
  if (left.length > 0)
    throw new Error(`still delegated: ${left.map((l) => label(l.target)).join(", ")}`);
  console.log(
    "\nevery account is back on the base layer; run pnpm setup-table --arm to delegate again",
  );
  const out = resolve(ROOT, "docs/proofs/teardown.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify({ table: addresses.at(-1)!.toBase58(), accounts: delegated.length, groups: steps }, null, 2)}\n`,
  );
  console.log(`wrote ${out}`);
}

if (process.argv[1]?.endsWith("teardown.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
