/**
 * Turns public market data into a Call: "up" or "down" on SOL/USD, a horizon, a stake. The AI
 * analysts ask Claude; a plain heuristic exists for local testing only and is never the default.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { type Record_, type Summary, hitRate } from "./market-data.js";

export const HORIZONS = [60, 120, 180] as const;

export type Decision = {
  direction: 1 | -1;
  horizon: (typeof HORIZONS)[number];
  stake: number;
  confidence: number;
  reason: string;
};

export type PredictInput = {
  summary: Summary;
  record: Record_;
  /** Desk chips available to stake. */
  chips: number;
};

export interface Predictor {
  readonly name: string;
  /** Resolves to a decision, or `undefined` when the model has nothing worth calling. Throws when unreachable. */
  predict(input: PredictInput): Promise<Decision | undefined>;
}

const MIN_STAKE = 10;
const MAX_STAKE = 100;

const raw = z.object({
  direction: z.union([z.string(), z.number()]),
  horizon: z.union([z.string(), z.number()]).optional(),
  stake: z.union([z.string(), z.number()]).optional(),
  confidence: z.union([z.string(), z.number()]).optional(),
  reason: z.string().optional(),
  skip: z.boolean().optional(),
});

const asNumber = (value: string | number | undefined, fallback: number) => {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Reads the first JSON object in a model answer and clamps it into something the program accepts.
 * Anything it cannot read as a clear direction is "no call".
 */
export function parseDecision(text: string, chips: number): Decision | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  let parsed: z.infer<typeof raw>;
  try {
    parsed = raw.parse(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return undefined;
  }
  if (parsed.skip) return undefined;
  const word = String(parsed.direction).trim().toLowerCase();
  const direction: 1 | -1 | undefined =
    word === "up" || word === "1" || word === "+1" || word === "long"
      ? 1
      : word === "down" || word === "-1" || word === "short"
        ? -1
        : undefined;
  if (!direction) return undefined;
  const wanted = Math.round(asNumber(parsed.horizon, 60));
  // the nearest allowed horizon
  const horizon = HORIZONS.reduce((best, h) =>
    Math.abs(h - wanted) < Math.abs(best - wanted) ? h : best,
  );
  // never more than the program accepts or than the chips available; too few chips means no call
  const stake = Math.min(MAX_STAKE, Math.round(asNumber(parsed.stake, 30)), Math.floor(chips));
  if (stake < MIN_STAKE) return undefined;
  const confidence = Math.max(0, Math.min(100, Math.round(asNumber(parsed.confidence, 50))));
  return { direction, horizon, stake, confidence, reason: (parsed.reason ?? "").slice(0, 160) };
}

const RULES = `You judge SOL/USD for a short game on devnet with play-money chips.
You see only public price data. Reply with ONE JSON object and nothing else:
{"direction":"up"|"down","horizon":60|120|180,"stake":10-100,"confidence":0-100,"reason":"max 12 words"}
or {"skip":true} if you see no edge. A Call is Right if the oracle price is higher (up) or lower (down)
than at the time you commit when the horizon ends; a flat price counts as Wrong. Size the stake to your
confidence and never stake more than the chips you have.`;

export const PERSONAS: Record<"claude" | "contrarian", string> = {
  claude: `You are Claude, a careful analyst. Weigh the short-term trend against how far the price has already moved.\n${RULES}`,
  contrarian: `You are the Contrarian. You fade stretched moves: a sharp rise in the last minutes is a reason to call down, a sharp fall a reason to call up, and you skip quiet markets.\n${RULES}`,
};

export const describeInput = ({ summary, record, chips }: PredictInput) =>
  [
    `SOL/USD now: ${summary.usd.toFixed(2)}`,
    `change 1m: ${summary.change1m.toFixed(3)}%  5m: ${summary.change5m.toFixed(3)}%  15m: ${summary.change15m.toFixed(3)}%`,
    `15m range: ${summary.low15m.toFixed(2)} to ${summary.high15m.toFixed(2)} (${summary.samples} samples)`,
    `your record: ${record.calls} calls, ${record.hits} right${hitRate(record) === undefined ? "" : ` (${hitRate(record)}%)`}, streak ${record.streak}, profit ${record.profit}`,
    `desk chips: ${Math.floor(chips)}`,
  ].join("\n");

/** Claude through the Anthropic API. Any network or API error propagates: the caller mints nothing. */
export class AnthropicPredictor implements Predictor {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(
    private readonly persona: keyof typeof PERSONAS,
    apiKey: string,
    private readonly model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
    client?: Anthropic,
  ) {
    this.name = `claude:${persona}`;
    this.client = client ?? new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }

  async predict(input: PredictInput): Promise<Decision | undefined> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 200,
      system: PERSONAS[this.persona],
      messages: [{ role: "user", content: describeInput(input) }],
    });
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return parseDecision(text, input.chips);
  }
}

/** Trend following, for local runs without an API key (`ANALYST_PREDICTOR=heuristic`). Not an AI. */
export class HeuristicPredictor implements Predictor {
  readonly name: string;

  constructor(private readonly contrarian = false) {
    this.name = contrarian ? "heuristic:contrarian" : "heuristic:trend";
  }

  async predict({ summary, chips }: PredictInput): Promise<Decision | undefined> {
    const move = summary.change5m || summary.change1m;
    if (move === 0) return undefined;
    const trend = move > 0 ? 1 : -1;
    const direction = (this.contrarian ? -trend : trend) as 1 | -1;
    const stake = Math.min(30, Math.floor(chips));
    if (stake < MIN_STAKE) return undefined;
    return { direction, horizon: 60, stake, confidence: 55, reason: "heuristic" };
  }
}
