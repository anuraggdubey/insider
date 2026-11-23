/**
 * The bot service: one loop per roster member (v1: front-runner, flow, baiter), each with its own
 * key and TEE login. `pnpm bots` runs them.
 */
import pino from "pino";

import { Bot } from "./bot.js";
import { loadConfig } from "./config.js";
import { loadAll } from "./keys.js";
import { membersFor } from "./roster.js";

async function main() {
  const log = pino({ level: process.env.LOG_LEVEL || "info" });
  const config = loadConfig();
  const members = loadAll(
    config.agentDir,
    membersFor("all").filter((member) => member.kind === "bot"),
  );
  log.info(
    {
      table: config.insider.tableAuthority?.toBase58(),
      bots: members.map(({ member, keypair }) => `${member.id} ${keypair.publicKey.toBase58()}`),
    },
    "starting the bot service",
  );

  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));

  await Promise.all(
    members.map(async ({ member, keypair }, i) => {
      const bot = new Bot(member, keypair, config.insider, log.child({ bot: member.id }));
      // stagger the starts so the TEE logins and the first decisions do not collide
      await new Promise((resolve) => setTimeout(resolve, i * 700));
      let failures = 0;
      while (!stopping) {
        try {
          await bot.step();
          failures = 0;
        } catch (error) {
          failures += 1;
          log.warn({ bot: member.id, error: String(error), failures }, "decision failed");
        }
        const backoff = Math.min(15_000, failures * 1_000);
        await new Promise((resolve) =>
          setTimeout(resolve, config.decisionMs + backoff + Math.random() * 300),
        );
      }
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
