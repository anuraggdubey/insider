/**
 * The AI service: two analyst seats that mint Desk Calls, and the commentary feed.
 *
 *   pnpm analysts
 *
 * Environment:
 *   XAI_API_KEY            enables the analysts' model with Grok (xAI); preferred when several keys are set
 *   XAI_MODEL              model id (default grok-4.7); XAI_REASONING_EFFORT low|medium|high|xhigh (default low)
 *   GROQ_API_KEY           the same with a Groq-hosted model (default openai/gpt-oss-120b); GROQ_MODEL,
 *                          GROQ_REASONING_EFFORT (default low, empty to omit)
 *   ANTHROPIC_API_KEY      enables the analysts' model with Claude; without either key they sit but mint nothing
 *   ANTHROPIC_MODEL        model id (default claude-haiku-5-5)
 *   AI_PROVIDER            "xai", "groq" or "anthropic" forces the provider when several keys are set
 *   ANALYST_PREDICTOR      "heuristic" runs a plain trend follower for local testing (not an AI)
 *   COMMENTARY_LLM=1       let the model reword the captions (they pause while it is unreachable)
 *   COMMENTARY_PORT        port of the caption feed (default 8788): GET /captions?since=<id>
 */
import { createServer } from "node:http";

import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";

import {
  decodeBoard,
  decodeCallBook,
  decodeOraclePrice,
  decodeSeason,
  decodeSeat,
  decodeTable,
  decodeTape,
  decodeXray,
  ORACLE_FEED,
  mintCall,
  tableAccounts,
  teeConnection,
} from "@insider/sdk/node";

import { Bot } from "../bot.js";
import { loadConfig } from "../config.js";
import { loadAll } from "../keys.js";
import { ROSTER } from "../roster.js";
import { AnalystDriver } from "./analyst.js";
import {
  CaptionFeed,
  Commentator,
  type Rewriter,
  diffEvents,
  type Snapshot,
} from "./commentary.js";
import { chatClientFor } from "./grok.js";
import { chooseProvider } from "./provider.js";
import {
  AnthropicPredictor,
  GrokPredictor,
  HeuristicPredictor,
  type Predictor,
} from "./predictor.js";
import { takeSnapshot } from "./snapshot.js";

const log = pino({ level: process.env.LOG_LEVEL || "info" });

function predictorFor(persona: "claude" | "contrarian"): Predictor | undefined {
  if (process.env.ANALYST_PREDICTOR === "heuristic")
    return new HeuristicPredictor(persona === "contrarian");
  const provider = chooseProvider();
  if (provider === "xai" || provider === "groq")
    return new GrokPredictor(persona, chatClientFor(provider), provider);
  if (provider === "anthropic")
    return new AnthropicPredictor(persona, process.env.ANTHROPIC_API_KEY!);
  return undefined;
}

const REWRITE_SYSTEM =
  "Rewrite each line as a punchy live-commentary caption of at most 14 words. Keep every name and number exactly. Reply with a JSON array of strings, same length and order, nothing else.";

function parseRewrite(text: string): string[] {
  const parsed = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("unexpected rewrite");
  }
  return parsed as string[];
}

function rewriter(): Rewriter | undefined {
  if (process.env.COMMENTARY_LLM !== "1") return undefined;
  const provider = chooseProvider();
  if (provider === "xai" || provider === "groq") {
    const grok = chatClientFor(provider, process.env, { timeoutMs: 20_000 });
    return async (texts) =>
      parseRewrite(
        await grok.complete({
          system: REWRITE_SYSTEM,
          user: JSON.stringify(texts),
          maxTokens: 2_000,
        }),
      );
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (provider !== "anthropic" || !key) return undefined;
  const client = new Anthropic({ apiKey: key, timeout: 15_000, maxRetries: 1 });
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  return async (texts) => {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system: REWRITE_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    });
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return parseRewrite(text);
  };
}

async function main() {
  const config = loadConfig();
  const accounts = tableAccounts(config.insider.tableAuthority!, config.insider.programId);
  const analysts = loadAll(
    config.agentDir,
    ROSTER.filter((member) => member.kind === "ai"),
  );
  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  if (!chooseProvider() && process.env.ANALYST_PREDICTOR !== "heuristic") {
    log.warn(
      "no XAI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY: the analysts take their seats but mint no Calls",
    );
  } else if (process.env.ANALYST_PREDICTOR !== "heuristic") {
    log.info({ provider: chooseProvider() }, "analyst model provider");
  }

  const loops = analysts.map(async ({ member, keypair }, i) => {
    const persona = member.persona === "analyst-contrarian" ? "contrarian" : "claude";
    const predictor = predictorFor(persona);
    let record = { calls: 0, hits: 0, streak: 0, profit: 0 };
    let recordAt = 0;
    let driver: AnalystDriver;
    const botLog = log.child({ bot: member.id });
    const bot: Bot = new Bot(member, keypair, config.insider, botLog, async (self, seen) => {
      if (Date.now() - recordAt > 30_000) {
        recordAt = Date.now();
        const info = await (await self.connection()).getAccountInfo(accounts.season);
        if (info) {
          const stats = decodeSeason(info.data).analysts[member.seat]!;
          record = {
            calls: stats.calls,
            hits: stats.hits,
            streak: stats.streak,
            profit: Number(stats.profit.toString()),
          };
        }
      }
      await driver.tick({
        owned: seen.seat.owner.equals(self.me),
        deskChips: Number(seen.seat.deskChips.toString()),
        hasOpenCall: seen.calls[member.seat]?.state === 1,
        record,
      });
    });
    driver = new AnalystDriver(predictor, {
      now: () => Date.now(),
      readPrice: async () => {
        const info = await (await bot.connection()).getAccountInfo(ORACLE_FEED);
        return info ? decodeOraclePrice(info.data)?.usd : undefined;
      },
      mint: async (decision) => {
        await bot.send(
          `mint a ${decision.horizon}s Call: ${decision.direction > 0 ? "up" : "down"} (${decision.reason})`,
          mintCall(config.insider, keypair.publicKey, member.seat, {
            direction: decision.direction,
            horizon: decision.horizon,
            stake: decision.stake,
            confidence: decision.confidence,
            licenseAsk: 15,
          }),
        );
      },
      log: botLog,
    });
    await sleep(i * 900);
    let failures = 0;
    while (!stopping) {
      try {
        await bot.step();
        failures = 0;
      } catch (error) {
        failures += 1;
        botLog.warn({ error: String(error).slice(0, 160), failures }, "decision failed");
      }
      await sleep(config.decisionMs * 2 + Math.min(15_000, failures * 1_000));
    }
  });

  // the caption feed: public accounts only, read without a login
  const feed = new CaptionFeed();
  const commentator = new Commentator(feed, rewriter());
  const port = Number(process.env.COMMENTARY_PORT || 8788);
  createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/captions") {
      response.end(
        JSON.stringify({
          paused: commentator.isPaused,
          captions: feed.since(Number(url.searchParams.get("since") ?? 0)),
        }),
      );
    } else if (url.pathname === "/health") {
      response.end(JSON.stringify({ ok: true }));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    }
  }).listen(port, () => log.info({ port }, "caption feed: GET /captions?since=<id>"));

  const loop = async () => {
    const connection = await teeConnection(config.insider);
    let previous: Snapshot | undefined;
    while (!stopping) {
      try {
        const keys = [
          accounts.table,
          accounts.board,
          accounts.callBook,
          accounts.tape,
          accounts.xray,
          ...accounts.seats,
        ];
        const [table, board, callBook, tape, xray, ...seats] =
          await connection.getMultipleAccountsInfo(keys);
        if (table && board && callBook && tape && xray && seats.every(Boolean)) {
          const snapshot = takeSnapshot({
            table: decodeTable(table.data),
            board: decodeBoard(board.data),
            calls: decodeCallBook(callBook.data).headers,
            tape: decodeTape(tape.data),
            seats: seats.map((s) => decodeSeat(s!.data)),
            xray: decodeXray(xray.data),
          });
          await commentator.push(diffEvents(previous, snapshot));
          previous = snapshot;
        }
        await commentator.flush();
      } catch (error) {
        log.warn({ error: String(error).slice(0, 160) }, "commentary read failed");
      }
      await sleep(1_000);
    }
  };
  await Promise.all([...loops, loop()]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
