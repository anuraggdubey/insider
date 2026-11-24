/** Which model provider the analysts and the caption rewording use, chosen by the keys set. */
export type Provider = "xai" | "anthropic";

export function chooseProvider(env: NodeJS.ProcessEnv = process.env): Provider | undefined {
  const forced = env.AI_PROVIDER?.toLowerCase();
  if (forced === "xai") return env.XAI_API_KEY ? "xai" : undefined;
  if (forced === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : undefined;
  if (env.XAI_API_KEY) return "xai";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return undefined;
}
