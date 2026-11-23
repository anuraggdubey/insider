/**
 * Public market data the analysts see: the SOL/USD oracle price over time and the analyst's own
 * public track record. Nothing private ever goes into a prompt.
 */
export type Sample = { at: number; usd: number };

export type Summary = {
  usd: number;
  /** Percent change over roughly the last minute, five minutes and fifteen minutes (or 0 if short). */
  change1m: number;
  change5m: number;
  change15m: number;
  high15m: number;
  low15m: number;
  samples: number;
};

/** A rolling window of oracle samples (at most one per `minGapMs`). */
export class PriceHistory {
  private readonly samples: Sample[] = [];

  constructor(
    private readonly maxAgeMs = 20 * 60_000,
    private readonly minGapMs = 5_000,
  ) {}

  add(at: number, usd: number): boolean {
    const last = this.samples.at(-1);
    if (last && at - last.at < this.minGapMs) return false;
    this.samples.push({ at, usd });
    while (this.samples.length > 1 && at - this.samples[0]!.at > this.maxAgeMs)
      this.samples.shift();
    return true;
  }

  get length() {
    return this.samples.length;
  }

  summary(now: number): Summary | undefined {
    const last = this.samples.at(-1);
    if (!last) return undefined;
    const change = (ms: number) => {
      const from = this.samples.find((sample) => now - sample.at <= ms);
      const base = from && from !== last ? from : undefined;
      return base ? ((last.usd - base.usd) / base.usd) * 100 : 0;
    };
    const recent = this.samples.filter((sample) => now - sample.at <= 15 * 60_000);
    const prices = recent.map((sample) => sample.usd);
    return {
      usd: last.usd,
      change1m: change(60_000),
      change5m: change(5 * 60_000),
      change15m: change(15 * 60_000),
      high15m: Math.max(...prices),
      low15m: Math.min(...prices),
      samples: this.samples.length,
    };
  }
}

export type Record_ = { calls: number; hits: number; streak: number; profit: number };

export const hitRate = (record: Record_) =>
  record.calls === 0 ? undefined : Math.round((100 * record.hits) / record.calls);
