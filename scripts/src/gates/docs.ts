import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROOT } from "../lib/config.js";
import type { GateResult } from "./lib.js";

/** What each gate asked and what a pass or cut changes (mirrors spec section 4). */
const QUESTIONS: Record<string, string> = {
  G0: "Can a non-member recover an order from the private mempool through any read path?",
  G1: "How many slots does the TEE advance per 500 ms tick, and how steady is it?",
  G2: "Is an account private when its only member is a keyless PDA (or the list is empty)?",
  G3: "Can a key with 0 SOL sign and pay on the TEE?",
  G4: "Can a program read a fresh SOL/USD feed inside the TEE?",
  G5: "Do deposit, private transfer and withdraw work on devnet-private with a platform fee account?",
  G6: "Can a post-commit Magic Action run our base-layer instruction (and update SOAR)?",
  G7: "Do session keys work with our program on the TEE?",
  G8: "Can an account be committed, undelegated and re-delegated repeatedly (the epoch cycle)?",
  G9: "If two crank tasks run the same tick, is state still correct?",
  G10: "Can a crank-scheduled instruction request VRF?",
};

const label = (status: string) =>
  ({ pass: "PASS", cut: "CUT", info: "INFO", error: "ERROR" })[status] ?? status.toUpperCase();

export function writeGatesDoc(
  results: GateResult[],
  addresses: Record<string, string>,
  notes: string,
) {
  const sorted = [...results].sort((a, b) => Number(a.gate.slice(1)) - Number(b.gate.slice(1)));
  const lines: string[] = [];
  lines.push("# Gates (Block 0 results)");
  lines.push("");
  lines.push(
    "Every gate is a script in `scripts/src/gates/` run against Solana devnet and the MagicBlock",
    "TEE. `pnpm gates` reruns them (a few minutes each); `pnpm gates --report` prints the last saved",
    "result. The raw transaction lists are in `docs/proofs/gates/gN.json`. The probe program the",
    "gates use is throwaway (`programs/gates`), deployed at",
    `\`${addresses["Gates probe program (throwaway)"]}\`; it is not part of the game.`,
    "",
  );
  lines.push("## Summary", "");
  lines.push("| Gate | Result | Decision |", "| --- | --- | --- |");
  for (const r of sorted) {
    lines.push(`| ${r.gate} ${r.name} | **${label(r.status)}** | ${r.decision} |`);
  }
  lines.push("");
  lines.push("## Addresses", "");
  lines.push("| What | Address |", "| --- | --- |");
  for (const [name, value] of Object.entries(addresses)) {
    lines.push(`| ${name} | \`${value}\` |`);
  }
  lines.push("");
  lines.push("## Evidence", "");
  for (const r of sorted) {
    lines.push(`### ${r.gate} ${r.name}: ${label(r.status)}`, "");
    lines.push(`*Question:* ${QUESTIONS[r.gate] ?? ""}`, "");
    lines.push(`*Decision:* ${r.decision}`, "");
    const shown = r.steps.slice(0, 12);
    if (shown.length > 0) {
      lines.push("| Step | Layer | Transaction |", "| --- | --- | --- |");
      for (const step of shown) {
        lines.push(
          `| ${step.step} | ${step.layer} | [${step.signature.slice(0, 12)}...](${step.url}) |`,
        );
      }
      if (r.steps.length > shown.length) {
        lines.push(
          "",
          `${r.steps.length - shown.length} more transactions in \`docs/proofs/gates/${r.gate.toLowerCase()}.json\`.`,
        );
      }
      lines.push("");
    }
  }
  if (notes) lines.push(notes);
  writeFileSync(resolve(ROOT, "docs/gates.md"), lines.join("\n") + "\n");
}
