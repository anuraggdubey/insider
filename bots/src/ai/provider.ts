/**
 * Which model provider the analysts and the caption rewording use, chosen by the keys set.
 * `xai` (Grok) and `groq` (Groq's hosted open models) both speak the OpenAI chat completions
 * protocol and share one client; `anthropic` (Claude) has its own SDK.
 */
export type Provider = "xai" | "groq" | "anthropic";

const KEYS: Record<Provider, string> = {
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Order of preference when several keys are set. */
const ORDER: Provider[] = ["xai", "groq", "anthropic"];

export function chooseProvider(env: NodeJS.ProcessEnv = process.env): Provider | undefined {
  const forced = env.AI_PROVIDER?.toLowerCase() as Provider | undefined;
  if (forced) return forced in KEYS && env[KEYS[forced]] ? forced : undefined;
  return ORDER.find((provider) => env[KEYS[provider]]);
}
