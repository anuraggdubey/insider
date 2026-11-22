import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const tools: Array<[string, string]> = [
  ["node", "node --version"],
  ["pnpm", "pnpm --version"],
  ["rustc (programs/)", "cd programs && rustc --version"],
  ["solana", "solana --version"],
  ["anchor", "anchor --version"],
  ["cargo build-sbf", "cargo build-sbf --version"],
];

let failed = false;
for (const [name, cmd] of tools) {
  try {
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .split("\n")[0];
    console.log(`ok   ${name}: ${out}`);
  } catch {
    failed = true;
    console.log(`FAIL ${name}: not found`);
  }
}

for (const file of [".keys/deployer.json", ".keys/insider-v1-program-keypair.json"]) {
  const ok = existsSync(file);
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${file}`);
}

process.exit(failed ? 1 : 0);
