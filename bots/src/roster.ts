/**
 * The fixed cast: which wallets the bot service runs. Each one has its own keypair file, so every
 * on-chain action is signed by exactly one identity. Seat classes follow the program: seats 0-4
 * are bots, 5-6 are AI analysts (spec 7.6).
 */

export type Persona =
  | "front-runner"
  | "baiter"
  | "flow"
  | "copycat"
  | "flipper"
  | "analyst-claude"
  | "analyst-contrarian";

export type Member = {
  /** File name stem under the agent key directory. */
  id: string;
  persona: Persona;
  kind: "bot" | "ai";
  /** Preferred seat; its class must match `kind`. */
  seat: number;
  /** Ships in the first version of the bot service (Block 2); the rest arrive in Block 3. */
  v1: boolean;
};

export const ROSTER: readonly Member[] = [
  { id: "bot-front-runner", persona: "front-runner", kind: "bot", seat: 0, v1: true },
  { id: "bot-flow", persona: "flow", kind: "bot", seat: 1, v1: true },
  { id: "bot-baiter", persona: "baiter", kind: "bot", seat: 2, v1: true },
  { id: "bot-copycat", persona: "copycat", kind: "bot", seat: 3, v1: false },
  { id: "bot-flipper", persona: "flipper", kind: "bot", seat: 4, v1: false },
  { id: "ai-analyst-claude", persona: "analyst-claude", kind: "ai", seat: 5, v1: false },
  { id: "ai-analyst-contrarian", persona: "analyst-contrarian", kind: "ai", seat: 6, v1: false },
];

/** Mirrors `Seat::kind_for_index` in the program. */
export const seatKind = (seat: number): "bot" | "ai" | "human" =>
  seat < 5 ? "bot" : seat < 7 ? "ai" : "human";

export const membersFor = (version: "v1" | "all"): Member[] =>
  ROSTER.filter((member) => version === "all" || member.v1);
