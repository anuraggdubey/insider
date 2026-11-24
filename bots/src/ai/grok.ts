/**
 * A minimal client for OpenAI-compatible chat completions APIs: xAI's Grok (`https://api.x.ai/v1`)
 * and Groq's hosted open models (`https://api.groq.com/openai/v1`). Used by the AI analysts and the
 * optional caption rewording. No SDK: one `fetch` call, so the network layer is easy to fake in
 * tests. Any network or API error throws; callers then mint or reword nothing.
 */

export const XAI_BASE_URL = "https://api.x.ai/v1";
/** Flagship model per docs.x.ai/developers/models (checked 2026-11-24). Override with `XAI_MODEL`. */
export const XAI_DEFAULT_MODEL = "grok-4.7";
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/** A reasoning model with JSON-friendly answers; answered in under a second on 2026-11-24. */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type GrokOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /**
   * `low`, `medium`, `high` or `xhigh`. Grok 4.x models always reason; `low` keeps the answer fast.
   * An empty string leaves the parameter out.
   */
  reasoningEffort?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
};

export type GrokRequest = {
  system: string;
  user: string;
  /** Includes the reasoning tokens, so keep it generous. */
  maxTokens?: number;
};

export class GrokClient {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly effort: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: GrokOptions) {
    this.model = options.model || XAI_DEFAULT_MODEL;
    this.baseUrl = (options.baseUrl || XAI_BASE_URL).replace(/\/$/, "");
    this.effort = options.reasoningEffort ?? "low";
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? (fetch as unknown as FetchLike);
  }

  /** The text of the first choice. */
  async complete({ system, user, maxTokens = 1_500 }: GrokRequest): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_completion_tokens: maxTokens,
      stream: false,
    };
    if (this.effort) body.reasoning_effort = this.effort;
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      // the status and the start of the error body; never the key
      throw new Error(`chat API ${response.status}: ${raw.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    let parsed: { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("the chat API returned a body that is not JSON");
    }
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("the chat API returned no message");
    return content;
  }
}

/**
 * The client for `xai` or `groq`, from the environment:
 * `<P>_API_KEY`, `<P>_MODEL`, `<P>_BASE_URL` and `<P>_REASONING_EFFORT` (low by default; set it
 * empty for a model that takes no such parameter).
 */
export function chatClientFor(
  provider: "xai" | "groq",
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<GrokOptions> = {},
): GrokClient {
  const prefix = provider === "xai" ? "XAI" : "GROQ";
  const apiKey = env[`${prefix}_API_KEY`];
  if (!apiKey) throw new Error(`${prefix}_API_KEY is not set`);
  return new GrokClient({
    apiKey,
    model: env[`${prefix}_MODEL`] || (provider === "xai" ? XAI_DEFAULT_MODEL : GROQ_DEFAULT_MODEL),
    baseUrl: env[`${prefix}_BASE_URL`] || (provider === "xai" ? XAI_BASE_URL : GROQ_BASE_URL),
    reasoningEffort: env[`${prefix}_REASONING_EFFORT`] ?? "low",
    ...overrides,
  });
}
