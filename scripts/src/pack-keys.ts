/**
 * pack-keys: bundles the service keys into one base64 string for a host's `KEYS_B64` setting.
 * It writes `.soak/keys.b64` (git-ignored) and prints nothing secret.
 *
 *   pnpm pack-keys
 *
 * Included: `deployer.json` (the table authority; the operators sign with it), `cup-operator.json`
 * (the cup operator's state, if it exists) and `agents/*.json` (the seven bot and analyst keys).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { ROOT } from "@insider/sdk/node";

const keys = resolve(ROOT, ".keys");
const files: Record<string, unknown> = {};
for (const name of [
  "deployer.json",
  "cup-operator.json",
  "soar-game.json",
  "soar-published.json",
]) {
  const path = resolve(keys, name);
  if (existsSync(path)) files[name] = JSON.parse(readFileSync(path, "utf8"));
}
for (const name of readdirSync(resolve(keys, "agents")).filter((f) => f.endsWith(".json"))) {
  files[`agents/${name}`] = JSON.parse(readFileSync(resolve(keys, "agents", name), "utf8"));
}
const out = resolve(ROOT, ".soak/keys.b64");
mkdirSync(resolve(ROOT, ".soak"), { recursive: true });
writeFileSync(out, Buffer.from(JSON.stringify(files)).toString("base64"));
console.log(`packed ${Object.keys(files).length} key files into ${out} (never commit or share it)`);
