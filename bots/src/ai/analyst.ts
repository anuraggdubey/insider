/**
 * The AI analysts' decision loop. Each analyst owns a seat, watches the public oracle price and, when
 * it has no Call open, asks its predictor for one and mints it through the SDK like anyone else. The
 * loop is pure over injected dependencies, so every refusal below is unit-tested.
 *
 * If the model is unreachable the analyst mints nothing and tries again after a back-off; nothing on
 * chain depends on it.
 */
import { type Record_, PriceHistory } from "./market-data.js";
import type { Decision, Predictor } from "./predictor.js";

export type AnalystDeps = {
  now(): number;
  /** The oracle price in USD, or `undefined` if the feed cannot be read. */
  readPrice(): Promise<number | undefined>;
  mint(decision: Decision): Promise<void>;
  log: {
    info(fields: object, message: string): void;
    warn(fields: object, message: string): void;
  };
};

export type AnalystState = {
  /** The seat belongs to this analyst. */
  owned: boolean;
  deskChips: number;
  /** A Call of this seat is still open. */
  hasOpenCall: boolean;
  record: Record_;
};

export type Outcome =
  | "minted"
  | "not-seated"
  | "open-call"
  | "no-model"
  | "cooldown"
  | "warming-up"
  | "low-chips"
  | "model-unavailable"
  | "no-edge";

export type AnalystOptions = {
  /** Least time between two Calls. */
  cooldownMs?: number;
  /** Oracle samples needed before the first Call. */
  minSamples?: number;
  /** Wait after a model failure. */
  backoffMs?: number;
  /** Chips kept back so the seat can still license and trade. */
  reserve?: number;
};

export class AnalystDriver {
  readonly history = new PriceHistory();
  private lastMint = Number.NEGATIVE_INFINITY;
  private retryAt = 0;
  private readonly options: Required<AnalystOptions>;

  constructor(
    private readonly predictor: Predictor | undefined,
    private readonly deps: AnalystDeps,
    options: AnalystOptions = {},
  ) {
    this.options = {
      cooldownMs: options.cooldownMs ?? 90_000,
      minSamples: options.minSamples ?? 6,
      backoffMs: options.backoffMs ?? 60_000,
      reserve: options.reserve ?? 100,
    };
  }

  async tick(state: AnalystState): Promise<Outcome> {
    const now = this.deps.now();
    // keep watching the market even when no Call is possible, so the first one is well informed
    const usd = await this.deps.readPrice();
    if (usd !== undefined) this.history.add(now, usd);

    if (!state.owned) return "not-seated";
    if (state.hasOpenCall) return "open-call";
    if (!this.predictor) return "no-model";
    if (now - this.lastMint < this.options.cooldownMs || now < this.retryAt) return "cooldown";
    if (this.history.length < this.options.minSamples) return "warming-up";
    const spendable = state.deskChips - this.options.reserve;
    if (spendable < 10) return "low-chips";
    const summary = this.history.summary(now);
    if (!summary) return "warming-up";

    let decision: Decision | undefined;
    try {
      decision = await this.predictor.predict({ summary, record: state.record, chips: spendable });
    } catch (error) {
      this.retryAt = now + this.options.backoffMs;
      this.deps.log.warn(
        { model: this.predictor.name, error: String(error).slice(0, 160) },
        "the model is unavailable: no Call minted",
      );
      return "model-unavailable";
    }
    if (!decision) {
      // nothing worth calling: look again after the cooldown instead of asking every second
      this.lastMint = now;
      return "no-edge";
    }
    await this.deps.mint(decision);
    this.lastMint = now;
    this.deps.log.info(
      {
        model: this.predictor.name,
        direction: decision.direction,
        horizon: decision.horizon,
        stake: decision.stake,
        reason: decision.reason,
      },
      "Call minted",
    );
    return "minted";
  }
}
