/**
 * The bot service: one loop per roster member (v1: front-runner, flow, baiter), each with its own
 * key and TEE login. `pnpm bots` runs them.
 */
import pino from "pino";

import { Bot } from "./bot.js";
import { loadConfig } from "./config.js";
import { loadAll } from "./keys.js";
import { membersFor } from "./roster.js";

const TICK_MS = 500;

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

  const bots = members.map(
    ({ member, keypair }) =>
      new Bot(member, keypair, config.insider, log.child({ bot: member.id })),
  );

  // The tick crank: one call every TICK_MS, rotating through the bots so a failing key or login
  // never stops the table. Logged only on failure; a tick every 500 ms would flood the log.
  const ticker = async () => {
    let turn = 0;
    let failures = 0;
    while (!stopping) {
      const bot = bots[turn++ % bots.length]!;
      try {
        await bot.tickIfBehind();
        failures = 0;
      } catch (error) {
        failures += 1;
        if (failures === 1 || failures % 20 === 0)
          log.warn(
            { bot: bot.member.id, error: String(error).slice(0, 200), failures },
            "tick failed",
          );
      }
      await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    }
  };

  await Promise.all([
    ticker(),
    ...bots.map(async (bot, i) => {
      const member = bot.member;
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
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
