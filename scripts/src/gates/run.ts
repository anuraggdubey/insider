/**
 * `pnpm gates`: runs the Block 0 gates against devnet and prints a pass or cut table.
 *
 *   pnpm gates                 run every gate in order (a few minutes each, uses devnet)
 *   pnpm gates --only g0,g4    run only some gates
 *   pnpm gates --report        do not run anything: print the last saved result of each gate
 *   pnpm gates --docs          rewrite docs/gates.md from the saved results
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROOT, config, loadKeypair } from "../lib/config.js";
import { writeGatesDoc } from "./docs.js";
import { GATES_PROGRAM_ID, NOBODY, type GateResult } from "./lib.js";

type Entry = { id: string; load: () => Promise<{ run: () => Promise<GateResult> }> };

/** Order matters: G0 decides the shape of the Floor, G1 feeds G9. */
const GATES: Entry[] = [
  { id: "g0", load: () => import("./g0-darkcheck.js") },
  { id: "g1", load: () => import("./g1-clock.js") },
  { id: "g2", load: () => import("./g2-keyless.js") },
  { id: "g3", load: () => import("./g3-zero-sol.js") },
  { id: "g4", load: () => import("./g4-oracle.js") },
  { id: "g5", load: () => import("./g5-payments.js") },
  { id: "g6", load: () => import("./g6-actions.js") },
  { id: "g7", load: () => import("./g7-session.js") },
  { id: "g8", load: () => import("./g8-epoch.js") },
  { id: "g9", load: () => import("./g9-cranks.js") },
  { id: "g10", load: () => import("./g10-crank-vrf.js") },
];

const dir = resolve(ROOT, "docs/proofs/gates");

function readSaved(id: string): GateResult | undefined {
  const path = resolve(dir, `${id}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as GateResult) : undefined;
}

function printTable(
  results: Array<GateResult | { gate: string; name: string; status: string; decision: string }>,
) {
  console.log("\nGate  Result  Name                         Decision");
  console.log(
    "----  ------  ---------------------------  --------------------------------------------",
  );
  for (const r of results) {
    console.log(
      `${r.gate.padEnd(4)}  ${r.status.toUpperCase().padEnd(6)}  ${r.name.padEnd(27)}  ${r.decision.slice(0, 110)}`,
    );
  }
  const cut = results.filter((r) => r.status === "cut").map((r) => r.gate);
  const errors = results.filter((r) => r.status === "error").map((r) => r.gate);
  console.log(
    `\n${results.filter((r) => r.status === "pass").length} pass, ${cut.length} cut${cut.length ? ` (${cut.join(", ")})` : ""}, ${results.filter((r) => r.status === "info").length} info, ${errors.length} error${errors.length ? ` (${errors.join(", ")})` : ""}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1]!.split(",") : undefined;
  const selected = GATES.filter((g) => !only || only.includes(g.id));

  const results: GateResult[] = [];
  if (args.includes("--report") || args.includes("--docs")) {
    for (const gate of selected) {
      const saved = readSaved(gate.id);
      if (saved) results.push(saved);
      else console.log(`${gate.id}: no saved result yet`);
    }
  } else {
    for (const gate of selected) {
      console.log(`\n=== ${gate.id.toUpperCase()} ===`);
      try {
        results.push(await (await gate.load()).run());
      } catch (error) {
        console.error(error);
        results.push({
          gate: gate.id.toUpperCase(),
          name: "(crashed)",
          status: "error",
          decision: (error as Error).message.slice(0, 120),
          facts: {},
          steps: [],
        });
      }
    }
  }

  printTable(results);
  if (args.includes("--docs")) {
    const fee =
      (results.find((r) => r.gate === "G5")?.facts.platformFeeAccount as string) ?? "(G5 not run)";
    writeGatesDoc(
      results,
      {
        "Game program (new ID)": config.programId.toBase58(),
        "Gates probe program (throwaway)": GATES_PROGRAM_ID.toBase58(),
        Deployer: loadKeypair(config.walletPath).publicKey.toBase58(),
        "Operator wallet": loadKeypair(resolve(ROOT, ".keys/operator.json")).publicKey.toBase58(),
        "Platform fee account (G5 test mint)": fee,
        "Keyless reader PDA (nobody)": NOBODY.toBase58(),
      },
      "",
    );
    console.log("wrote docs/gates.md");
  }
  if (!args.includes("--report") && !args.includes("--docs")) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      resolve(dir, "summary.json"),
      JSON.stringify(
        results.map(({ gate, name, status, decision }) => ({ gate, name, status, decision })),
        null,
        2,
      ) + "\n",
    );
  }
  process.exit(results.some((r) => r.status === "error") ? 1 : 0);
}

main();
