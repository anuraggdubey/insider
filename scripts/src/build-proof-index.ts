/**
 * Builds the proof index from the proof JSON files the demo scripts write:
 *
 *   docs/proofs/README.md                  the readable index
 *   app/src/lib/proofs.generated.json      what the /proof page shows
 *
 * Usage: pnpm proofs
 *
 * The files differ in shape (`steps` with `step` or `what`, some with no steps, a few with
 * `events` or `checks`), so everything is normalised first: a title, the checks that passed, and
 * the transactions with links. Entries without a signature are not transactions and are skipped.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ROOT } from "./lib/config.js";

type Raw = Record<string, unknown>;
type Link = { label: string; url: string; layer?: string };
export type ProofEntry = {
  id: string;
  title: string;
  summary: string;
  checks: Array<{ name: string; pass: boolean }>;
  links: Link[];
  facts: Record<string, string>;
};

const dir = resolve(ROOT, "docs/proofs");

/** Known proofs: title and one line of what they show. Others fall back to their file name. */
const known: Record<string, { title: string; summary: string }> = {
  "vertical-slice": {
    title: "One full round",
    summary: "Seed, 200 ticks on the rollup, scoring and reseal on the live table.",
  },
  "simulate-round": {
    title: "A scripted round: buy, open, front-run, X-ray",
    summary: "Three keys play a round; the X-ray shows exactly what happened.",
  },
  "privacy-test": {
    title: "Privacy probes",
    summary:
      "The opener, another seat, the authority and an anonymous client try to read sealed data.",
  },
  "go-live": {
    title: "A human seat on the live table",
    summary: "A human joined and sent orders while the bots played and scored rounds on their own.",
  },
  epoch: {
    title: "Epoch cycle",
    summary: "Season committed to the base layer and opened again, repeatedly.",
  },
  desk: {
    title: "The Desk: a Call from mint to judgement",
    summary: "A private Call, a licence sale, an oracle-settled verdict and the author's record.",
  },
  cup: {
    title: "The Alpha Cup",
    summary: "Private buy-ins, five rounds, 60/40 private payouts and the platform fee.",
  },
  session: {
    title: "Session keys",
    summary:
      "A key with no SOL plays for a wallet; strangers, wrong seats and revoked keys are refused.",
  },
  soak: {
    title: "60-minute soak",
    summary: "Five bots, two AI analysts and the operators ran an hour with no failed step.",
  },
  soar: {
    title: "SOAR leaderboard",
    summary: "A SOAR game and leaderboard on devnet fed with season scores by the game authority.",
  },
  teardown: {
    title: "Teardown and re-setup",
    summary: "The whole table recovered from the base layer.",
  },
  recovery: {
    title: "Recovery paths",
    summary: "Undelegation requests honoured by the validator.",
  },
};

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

function links(raw: Raw): Link[] {
  const out: Link[] = [];
  const lists = [raw.steps, raw.events].filter(Array.isArray) as Raw[][];
  for (const list of lists) {
    for (const entry of list) {
      const url = text(entry.url);
      const label = text(entry.step) ?? text(entry.what);
      if (url && label)
        out.push({
          label: label.replace(/\s+/g, " ").slice(0, 110),
          url,
          layer: text(entry.layer),
        });
    }
  }
  return out.filter((link, i, all) => all.findIndex((other) => other.url === link.url) === i);
}

function checksOf(raw: Raw) {
  const checks = Array.isArray(raw.checks) ? (raw.checks as Raw[]) : [];
  const out = checks
    .filter((check) => typeof check.name === "string")
    .map((check) => ({ name: String(check.name), pass: Boolean(check.pass) }));
  const verdict = raw.verdict as Raw | undefined;
  if (verdict && typeof verdict.total === "number") {
    out.push({
      name: `${verdict.passed} of ${verdict.total} privacy probes passed`,
      pass: verdict.passed === verdict.total,
    });
  }
  return out;
}

function factsOf(raw: Raw) {
  const facts: Record<string, string> = {};
  for (const key of [
    "table",
    "program",
    "wallet",
    "sessionKey",
    "sessionToken",
    "game",
    "leaderboard",
  ]) {
    const value = text(raw[key]);
    if (value) facts[key] = value;
  }
  return facts;
}

const ids = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))
  .filter((id) => id in known)
  .sort((a, b) => Object.keys(known).indexOf(a) - Object.keys(known).indexOf(b));

const entries: ProofEntry[] = ids.map((id) => {
  const raw = JSON.parse(readFileSync(resolve(dir, `${id}.json`), "utf8")) as Raw;
  return { id, ...known[id]!, checks: checksOf(raw), links: links(raw), facts: factsOf(raw) };
});

const gates = (() => {
  const out: Array<{ gate: string; name: string; status: string; decision: string }> = [];
  const gateDir = resolve(dir, "gates");
  if (!existsSync(gateDir)) return out;
  for (const file of readdirSync(gateDir).filter((f) => /^g\d+\.json$/.test(f))) {
    const raw = JSON.parse(readFileSync(resolve(gateDir, file), "utf8")) as Raw;
    out.push({
      gate: String(raw.gate),
      name: String(raw.name),
      status: String(raw.status),
      decision: String(raw.decision),
    });
  }
  return out.sort((a, b) => Number(a.gate.slice(1)) - Number(b.gate.slice(1)));
})();

const generated = resolve(ROOT, "app/src/lib/proofs.generated.json");
mkdirSync(dirname(generated), { recursive: true });
writeFileSync(generated, `${JSON.stringify({ entries, gates }, null, 2)}\n`);

const sections = entries.map((entry) =>
  [
    `## ${entry.title}`,
    "",
    entry.summary,
    "",
    `Raw data: [${entry.id}.json](${entry.id}.json)`,
    "",
    ...Object.entries(entry.facts).map(([key, value]) => `- **${key}:** \`${value}\``),
    "",
    ...entry.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"}: ${check.name}`),
    "",
    ...(entry.links.length
      ? [
          "| Step | Layer | Transaction |",
          "|---|---|---|",
          ...entry.links.map(
            (link) =>
              `| ${link.label.replace(/\|/g, "/")} | ${link.layer ?? ""} | [open](${link.url}) |`,
          ),
        ]
      : []),
    "",
  ].join("\n"),
);

const intro = `# Onchain proofs (devnet)

Generated by \`pnpm proofs\` from the demo scripts in \`scripts/src\`. Every row links to a real
devnet transaction. Rollup and TEE transactions use the Solana Explorer custom-cluster link; if a
view is empty, query the endpoint named in the facts directly.

Earlier experiments and the gate decisions: [gates.md](../gates.md), [../phase-2-findings.md](../phase-2-findings.md).

`;

writeFileSync(resolve(dir, "README.md"), intro + sections.join("\n"));
console.log(
  `wrote docs/proofs/README.md and app/src/lib/proofs.generated.json (${entries.length} proofs, ${gates.length} gates)`,
);
