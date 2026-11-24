/**
 * The maths of the soak report (A-4.4): what the table did while it ran, and what the services
 * logged. Pure, so it is unit-tested; `pnpm soak-report` feeds it live samples and the log files.
 */

export type Sample = {
  /** Milliseconds since the epoch. */
  t: number;
  roundId: number;
  phase: string;
  tick: number;
  epoch: number;
  /** `table.armed_until_slot` and the current rollup slot. */
  armedUntilSlot: number;
  slot: number;
};

export type Stall = {
  startedAt: number;
  endedAt: number;
  ms: number;
  roundId: number;
  phase: string;
};

export type TableSummary = {
  samples: number;
  durationMs: number;
  firstRound: number;
  lastRound: number;
  /** Rounds that ended while the watcher was running. */
  roundsCompleted: number;
  epochChanges: number;
  phasesSeen: Record<string, number>;
  stalls: Stall[];
  longestStallMs: number;
  /** Samples where the crank's armed window had already run out. */
  unarmedSamples: number;
  /** Times the armed window was extended (the deadline moved forward). */
  armings: number;
  unreadableSamples: number;
};

/** A table that does not move for this long is stalled (a VRF seed normally lands in seconds). */
export const STALL_MS = 20_000;

export class SoakTracker {
  private readonly stallMs: number;
  private previous?: Sample;
  private lastMoveAt = 0;
  private openStall?: Stall;
  private first?: Sample;
  private last?: Sample;
  private summaryState: TableSummary = {
    samples: 0,
    durationMs: 0,
    firstRound: 0,
    lastRound: 0,
    roundsCompleted: 0,
    epochChanges: 0,
    phasesSeen: {},
    stalls: [],
    longestStallMs: 0,
    unarmedSamples: 0,
    armings: 0,
    unreadableSamples: 0,
  };

  constructor(options: { stallMs?: number } = {}) {
    this.stallMs = options.stallMs ?? STALL_MS;
  }

  /** The table could not be read at this moment (counts against the run, not as a stall by itself). */
  unreadable() {
    this.summaryState.unreadableSamples += 1;
  }

  push(sample: Sample) {
    const s = this.summaryState;
    s.samples += 1;
    s.phasesSeen[sample.phase] = (s.phasesSeen[sample.phase] ?? 0) + 1;
    if (!this.first) {
      this.first = sample;
      this.lastMoveAt = sample.t;
    }
    const prev = this.previous;
    if (prev) {
      if (sample.roundId > prev.roundId) s.roundsCompleted += sample.roundId - prev.roundId;
      if (sample.epoch !== prev.epoch) s.epochChanges += 1;
      if (sample.armedUntilSlot > prev.armedUntilSlot) s.armings += 1;
      const moved =
        sample.roundId !== prev.roundId ||
        sample.phase !== prev.phase ||
        sample.tick !== prev.tick ||
        sample.epoch !== prev.epoch;
      if (moved) {
        this.closeStall(sample.t);
        this.lastMoveAt = sample.t;
      } else if (!this.openStall && sample.t - this.lastMoveAt >= this.stallMs) {
        this.openStall = {
          startedAt: this.lastMoveAt,
          endedAt: sample.t,
          ms: sample.t - this.lastMoveAt,
          roundId: sample.roundId,
          phase: sample.phase,
        };
      } else if (this.openStall) {
        this.openStall.endedAt = sample.t;
        this.openStall.ms = sample.t - this.openStall.startedAt;
      }
    }
    if (sample.slot > sample.armedUntilSlot) s.unarmedSamples += 1;
    this.previous = sample;
    this.last = sample;
  }

  private closeStall(now: number) {
    if (!this.openStall) return;
    this.openStall.endedAt = now;
    this.openStall.ms = now - this.openStall.startedAt;
    this.summaryState.stalls.push(this.openStall);
    this.openStall = undefined;
  }

  /** Whether the table is stalled right now (for the live status line). */
  get stalledNow(): boolean {
    return this.openStall !== undefined;
  }

  summary(): TableSummary {
    const s = this.summaryState;
    const stalls = [...s.stalls, ...(this.openStall ? [this.openStall] : [])];
    return {
      ...s,
      stalls,
      durationMs: this.first && this.last ? this.last.t - this.first.t : 0,
      firstRound: this.first?.roundId ?? 0,
      lastRound: this.last?.roundId ?? 0,
      longestStallMs: stalls.reduce((max, stall) => Math.max(max, stall.ms), 0),
    };
  }
}

export type LogStats = {
  lines: number;
  unparsed: number;
  /** pino level 50 and above. */
  errors: number;
  /** pino level 40. */
  warnings: number;
  /** "decision failed": a bot's step threw, which is a failed transaction or a failed read. */
  failuresByBot: Record<string, number>;
  /** Successful transactions by bot (info lines that carry a signature). */
  sentByBot: Record<string, number>;
  /** Successful transactions by instruction (the log message, with seat and slot numbers folded). */
  sentByAction: Record<string, number>;
  rearms: number;
  commitEpochs: number;
  openEpochs: number;
  roundsFinished: number;
  prizesPaid: number;
  cupsClosed: number;
  cupJoins: number;
  operatorStepFailures: number;
  /** The most frequent failure texts, for the fix list. */
  topFailures: Array<{ text: string; count: number }>;
};

export const emptyLogStats = (): LogStats => ({
  lines: 0,
  unparsed: 0,
  errors: 0,
  warnings: 0,
  failuresByBot: {},
  sentByBot: {},
  sentByAction: {},
  rearms: 0,
  commitEpochs: 0,
  openEpochs: 0,
  roundsFinished: 0,
  prizesPaid: 0,
  cupsClosed: 0,
  cupJoins: 0,
  operatorStepFailures: 0,
  topFailures: [],
});

const bump = (record: Record<string, number>, key: string, by = 1) => {
  record[key] = (record[key] ?? 0) + by;
};

/** `bid on slot 3` and `bid on slot 4` are the same action. */
export const foldAction = (message: string) => message.replace(/\d+/g, "#");

const normaliseFailure = (text: string) =>
  text
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, "<key>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 140);

/** Reads pino JSON lines; anything else counts as unparsed. Several files merge with `mergeLogStats`. */
export function parseLog(text: string): LogStats {
  const stats = emptyLogStats();
  const failures = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    stats.lines += 1;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      stats.unparsed += 1;
      continue;
    }
    const level = Number(entry.level ?? 30);
    const msg = String(entry.msg ?? "");
    const bot = typeof entry.bot === "string" ? entry.bot : undefined;
    if (level >= 50) stats.errors += 1;
    else if (level >= 40) stats.warnings += 1;

    if (msg === "decision failed") {
      bump(stats.failuresByBot, bot ?? "unknown");
      const key = normaliseFailure(String(entry.error ?? ""));
      failures.set(key, (failures.get(key) ?? 0) + 1);
    } else if (msg === "operator step failed" || msg === "commentary read failed") {
      stats.operatorStepFailures += 1;
      const key = normaliseFailure(`${msg}: ${String(entry.error ?? "")}`);
      failures.set(key, (failures.get(key) ?? 0) + 1);
    } else if (level >= 40) {
      const key = normaliseFailure(`${msg}: ${String(entry.error ?? "")}`);
      failures.set(key, (failures.get(key) ?? 0) + 1);
    }

    if (typeof entry.signature === "string" && level < 40) {
      bump(stats.sentByBot, bot ?? "service");
      bump(stats.sentByAction, foldAction(msg));
      if (msg === "rearm_ticks") stats.rearms += 1;
      if (msg === "commit_epoch") stats.commitEpochs += 1;
      if (msg === "finish_round") stats.roundsFinished += 1;
      if (msg.startsWith("open_epoch")) stats.openEpochs += 1;
      if (msg === "prize paid") stats.prizesPaid += 1;
      if (msg === "cup_join co-signed") stats.cupJoins += 1;
    } else if (msg.startsWith("open_epoch")) {
      stats.openEpochs += 1;
    } else if (msg === "prize paid") {
      stats.prizesPaid += 1;
    } else if (msg === "cup_join co-signed") {
      stats.cupJoins += 1;
    }
    if (msg === "cup paid and closed: the next cup is open") stats.cupsClosed += 1;
  }
  stats.topFailures = [...failures.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, count]) => ({ text, count }));
  return stats;
}

export function mergeLogStats(parts: LogStats[]): LogStats {
  const out = emptyLogStats();
  const failures = new Map<string, number>();
  for (const part of parts) {
    out.lines += part.lines;
    out.unparsed += part.unparsed;
    out.errors += part.errors;
    out.warnings += part.warnings;
    out.rearms += part.rearms;
    out.commitEpochs += part.commitEpochs;
    out.openEpochs += part.openEpochs;
    out.roundsFinished += part.roundsFinished;
    out.prizesPaid += part.prizesPaid;
    out.cupsClosed += part.cupsClosed;
    out.cupJoins += part.cupJoins;
    out.operatorStepFailures += part.operatorStepFailures;
    for (const [k, v] of Object.entries(part.failuresByBot)) bump(out.failuresByBot, k, v);
    for (const [k, v] of Object.entries(part.sentByBot)) bump(out.sentByBot, k, v);
    for (const [k, v] of Object.entries(part.sentByAction)) bump(out.sentByAction, k, v);
    for (const failure of part.topFailures)
      failures.set(failure.text, (failures.get(failure.text) ?? 0) + failure.count);
  }
  out.topFailures = [...failures.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, count]) => ({ text, count }));
  return out;
}

/** PowerShell's `>` writes UTF-16; read that as well as plain UTF-8. */
export function decodeLogFile(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe)
    return buffer.subarray(2).toString("utf16le");
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)
    return buffer.subarray(3).toString("utf8");
  return buffer.toString("utf8");
}

export type Verdict = { name: string; pass: boolean; detail: string };

/**
 * The soak passes when the table kept playing rounds, never stalled for long, nothing failed a lot,
 * and the epochs rolled. The run must also be long enough to mean something.
 */
export function judge(
  table: TableSummary,
  logs: LogStats,
  options: { minutes: number; minRoundsPerMinute?: number; maxStallMs?: number },
): Verdict[] {
  const minutes = table.durationMs / 60_000;
  const rate = minutes > 0 ? table.roundsCompleted / minutes : 0;
  const maxStall = options.maxStallMs ?? 60_000;
  const totalFailures = Object.values(logs.failuresByBot).reduce((a, b) => a + b, 0);
  const totalSent = Object.values(logs.sentByBot).reduce((a, b) => a + b, 0);
  return [
    {
      name: "the run lasted as long as planned",
      pass: table.durationMs >= options.minutes * 60_000 - 15_000,
      detail: `${minutes.toFixed(1)} of ${options.minutes} min watched`,
    },
    {
      name: "the table kept completing rounds",
      pass: table.roundsCompleted >= 1 && rate >= (options.minRoundsPerMinute ?? 0.5),
      detail: `${table.roundsCompleted} rounds, ${rate.toFixed(2)} per minute`,
    },
    {
      name: `no stall longer than ${Math.round(maxStall / 1000)} s`,
      pass: table.longestStallMs <= maxStall,
      detail: `${table.stalls.length} stalls, longest ${Math.round(table.longestStallMs / 1000)} s`,
    },
    {
      name: "the crank never ran out",
      pass: table.unarmedSamples === 0,
      detail: `${table.unarmedSamples} samples past the armed window, ${table.armings} extensions seen`,
    },
    {
      name: "failed steps stay under 2% of the transactions sent",
      pass:
        totalSent === 0 ? totalFailures === 0 : totalFailures / (totalSent + totalFailures) < 0.02,
      detail: `${totalFailures} failed, ${totalSent} sent`,
    },
    {
      name: "no error-level log lines",
      pass: logs.errors === 0,
      detail: `${logs.errors} errors, ${logs.warnings} warnings`,
    },
  ];
}
