/**
 * soak-report (A-4.4): watches the live table for the whole soak run and writes the verdict.
 *
 * It samples the public table every two seconds (rounds completed, stalls, epoch changes, the
 * crank's armed window) and, when the run ends, reads the service logs for failed steps per bot,
 * crank re-arms, epoch calls and cup payouts. It sends no transactions and needs no keys.
 *
 *   pnpm soak-report                      60 minutes, logs from .soak/*.log
 *   pnpm soak-report --minutes 5          a short rehearsal
 *   pnpm soak-report --log path/to/a.log  extra log files (repeatable)
 *
 * Start the services with their output in `.soak/` (see docs/runbook.md, "Soak"), then run this in
 * another terminal. Writes `docs/proofs/soak.json`; exit code 1 when a check fails.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { PublicKey } from "@solana/web3.js";

import {
  ROOT,
  config as baseConfig,
  decodeTable,
  loadKeypair,
  tableAccounts,
  teeConnection,
} from "@insider/sdk/node";

import {
  type Sample,
  SoakTracker,
  decodeLogFile,
  judge,
  mergeLogStats,
  parseLog,
} from "./lib/soak.js";

const SAMPLE_MS = 2_000;
const STATUS_MS = 60_000;

function args() {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const logs: string[] = [];
  argv.forEach((arg, index) => {
    if (arg === "--log" && argv[index + 1]) logs.push(resolve(argv[index + 1]!));
  });
  const minutes = Number(value("--minutes") ?? 60);
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("--minutes must be positive");
  return { minutes, logs };
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const phaseName = (phase: object) => Object.keys(phase)[0] ?? "unknown";

async function main() {
  const { minutes, logs } = args();
  // the table authority: from the environment, else the deployer key on this machine (public key only)
  const authority = process.env.NEXT_PUBLIC_TABLE_AUTHORITY
    ? new PublicKey(process.env.NEXT_PUBLIC_TABLE_AUTHORITY)
    : loadKeypair(baseConfig.walletPath).publicKey;
  const config = { ...baseConfig, tableAuthority: authority };
  const accounts = tableAccounts(authority, config.programId);
  const connection = await teeConnection(config);
  const tracker = new SoakTracker();
  const startedAt = Date.now();
  const endAt = startedAt + minutes * 60_000;
  let interrupted = false;
  process.on("SIGINT", () => (interrupted = true));
  process.on("SIGTERM", () => (interrupted = true));

  console.log(
    `soak-report: watching ${accounts.table.toBase58()} for ${minutes} min (Ctrl-C ends early)`,
  );
  let lastStatus = startedAt;
  while (Date.now() < endAt && !interrupted) {
    try {
      const [info, slot] = await Promise.all([
        connection.getAccountInfo(accounts.table),
        connection.getSlot(),
      ]);
      if (!info) throw new Error("table not readable");
      const table = decodeTable(info.data);
      const sample: Sample = {
        t: Date.now(),
        roundId: Number(table.roundId.toString()),
        phase: phaseName(table.phase),
        tick: Number(table.tick.toString()),
        epoch: Number(table.epoch.toString()),
        armedUntilSlot: Number(table.armedUntilSlot.toString()),
        slot,
      };
      tracker.push(sample);
    } catch {
      tracker.unreadable();
    }
    if (Date.now() - lastStatus >= STATUS_MS) {
      lastStatus = Date.now();
      const s = tracker.summary();
      console.log(
        `${Math.round((Date.now() - startedAt) / 60_000)} min: ${s.roundsCompleted} rounds, ${s.epochChanges} epoch changes, ${s.stalls.length} stalls (longest ${Math.round(s.longestStallMs / 1000)} s)${tracker.stalledNow ? "  STALLED NOW" : ""}`,
      );
    }
    await sleep(SAMPLE_MS);
  }

  const files = [
    ...logs,
    ...(existsSync(resolve(ROOT, ".soak"))
      ? readdirSync(resolve(ROOT, ".soak"))
          .filter((file) => file.endsWith(".log"))
          .map((file) => resolve(ROOT, ".soak", file))
      : []),
  ].filter((file, index, all) => all.indexOf(file) === index);
  const perFile = files.map((file) => ({
    file: relative(ROOT, file).replaceAll("\\", "/"),
    stats: parseLog(decodeLogFile(readFileSync(file))),
  }));
  const merged = mergeLogStats(perFile.map((entry) => entry.stats));
  const table = tracker.summary();
  const verdicts = [
    {
      name: "service logs were read",
      pass: files.length > 0 && merged.lines > 0,
      detail: `${files.length} files, ${merged.lines} lines (${merged.unparsed} unparsed)`,
    },
    ...judge(table, merged, { minutes: interrupted ? 0 : minutes }),
  ];

  console.log("\ntable");
  console.log(
    `  ${table.roundsCompleted} rounds completed (${table.firstRound} to ${table.lastRound}), ${table.epochChanges} epoch changes, ${table.armings} crank extensions seen, ${table.unreadableSamples} unreadable samples`,
  );
  for (const stall of table.stalls)
    console.log(
      `  stall of ${Math.round(stall.ms / 1000)} s in round ${stall.roundId} (${stall.phase}) from ${new Date(stall.startedAt).toISOString().slice(11, 19)}`,
    );
  console.log("\nservices");
  console.log(
    `  sent ${JSON.stringify(merged.sentByBot)}\n  failed steps ${JSON.stringify(merged.failuresByBot)}`,
  );
  console.log(
    `  re-arms ${merged.rearms}, commit_epoch ${merged.commitEpochs}, open_epoch ${merged.openEpochs}, finish_round ${merged.roundsFinished}, cup joins ${merged.cupJoins}, prizes paid ${merged.prizesPaid}, cups closed ${merged.cupsClosed}`,
  );
  for (const failure of merged.topFailures) console.log(`  ${failure.count} x ${failure.text}`);
  console.log("\nchecks");
  for (const v of verdicts) console.log(`  ${v.pass ? "PASS" : "FAIL"}  ${v.name}: ${v.detail}`);

  const out = resolve(ROOT, "docs/proofs/soak.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        table: accounts.table.toBase58(),
        program: config.programId.toBase58(),
        startedAt: new Date(startedAt).toISOString(),
        plannedMinutes: minutes,
        endedEarly: interrupted,
        tableSummary: table,
        logs: perFile.map((entry) => ({ file: entry.file, ...entry.stats })),
        services: merged,
        checks: verdicts,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nwrote ${out}`);
  process.exit(verdicts.every((v) => v.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
