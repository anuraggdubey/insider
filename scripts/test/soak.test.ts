import { describe, expect, it } from "vitest";

import {
  type Sample,
  SoakTracker,
  decodeLogFile,
  foldAction,
  judge,
  mergeLogStats,
  parseLog,
} from "../src/lib/soak.js";

const sample = (t: number, over: Partial<Sample> = {}): Sample => ({
  t,
  roundId: 10,
  phase: "live",
  tick: 0,
  epoch: 1,
  armedUntilSlot: 10_000,
  slot: 1_000,
  ...over,
});

describe("SoakTracker", () => {
  it("counts rounds that ended, epoch changes and crank extensions", () => {
    const tracker = new SoakTracker();
    tracker.push(sample(0, { tick: 1 }));
    tracker.push(sample(2_000, { tick: 5 }));
    tracker.push(sample(4_000, { roundId: 11, phase: "idle", tick: 0 }));
    tracker.push(sample(6_000, { roundId: 11, tick: 3, epoch: 2, armedUntilSlot: 20_000 }));
    const summary = tracker.summary();
    expect(summary.roundsCompleted).toBe(1);
    expect(summary.epochChanges).toBe(1);
    expect(summary.armings).toBe(1);
    expect(summary.firstRound).toBe(10);
    expect(summary.lastRound).toBe(11);
    expect(summary.durationMs).toBe(6_000);
    expect(summary.phasesSeen).toEqual({ live: 3, idle: 1 });
    expect(summary.stalls).toEqual([]);
  });

  it("records a stall once the table stops moving for the threshold, and its end", () => {
    const tracker = new SoakTracker({ stallMs: 10_000 });
    tracker.push(sample(0, { tick: 7 }));
    for (let t = 2_000; t <= 14_000; t += 2_000) tracker.push(sample(t, { tick: 7 }));
    expect(tracker.stalledNow).toBe(true);
    expect(tracker.summary().stalls).toHaveLength(1);
    tracker.push(sample(16_000, { tick: 8 }));
    expect(tracker.stalledNow).toBe(false);
    const summary = tracker.summary();
    expect(summary.stalls).toHaveLength(1);
    expect(summary.stalls[0]).toMatchObject({ startedAt: 0, endedAt: 16_000, ms: 16_000 });
    expect(summary.longestStallMs).toBe(16_000);
  });

  it("does not call a short pause a stall", () => {
    const tracker = new SoakTracker({ stallMs: 10_000 });
    tracker.push(sample(0, { tick: 1 }));
    tracker.push(sample(4_000, { tick: 1 }));
    tracker.push(sample(8_000, { tick: 2 }));
    expect(tracker.summary().stalls).toEqual([]);
  });

  it("counts samples past the armed window and unreadable samples", () => {
    const tracker = new SoakTracker();
    tracker.push(sample(0, { slot: 20_000 }));
    tracker.push(sample(2_000, { slot: 5_000, tick: 1 }));
    tracker.unreadable();
    const summary = tracker.summary();
    expect(summary.unarmedSamples).toBe(1);
    expect(summary.unreadableSamples).toBe(1);
  });
});

const line = (entry: Record<string, unknown>) => JSON.stringify({ level: 30, ...entry });

describe("parseLog", () => {
  const key = "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
  const text = [
    line({ bot: "bot-flow", signature: "s1", msg: "bid on slot 2" }),
    line({ bot: "bot-flow", signature: "s2", msg: "bid on slot 4" }),
    line({ bot: "bot-baiter", signature: "s3", msg: "rearm_ticks" }),
    line({ bot: "bot-front-runner", signature: "s4", msg: "finish_round" }),
    line({ bot: "bot-front-runner", signature: "s5", msg: "commit_epoch" }),
    line({ signature: "s6", epoch: 3, msg: "open_epoch: the next season is delegated" }),
    line({
      level: 40,
      bot: "bot-flow",
      error: `Error: custom program error: 0x1773 at ${key}`,
      msg: "decision failed",
    }),
    line({
      level: 40,
      bot: "bot-flow",
      error: `Error: custom program error: 0x1774 at ${key}`,
      msg: "decision failed",
    }),
    line({ level: 40, error: "boom", msg: "operator step failed" }),
    line({ level: 50, msg: "fatal thing" }),
    line({ signature: "p1", msg: "prize paid" }),
    line({ msg: "cup paid and closed: the next cup is open" }),
    "not json",
    "",
  ].join("\n");

  it("counts sent transactions, failures per bot and the crank and epoch calls", () => {
    const stats = parseLog(text);
    expect(stats.lines).toBe(13);
    expect(stats.unparsed).toBe(1);
    expect(stats.sentByBot).toEqual({
      "bot-flow": 2,
      "bot-baiter": 1,
      "bot-front-runner": 2,
      service: 2,
    });
    expect(stats.sentByAction["bid on slot #"]).toBe(2);
    expect(stats.failuresByBot).toEqual({ "bot-flow": 2 });
    expect(stats.rearms).toBe(1);
    expect(stats.roundsFinished).toBe(1);
    expect(stats.commitEpochs).toBe(1);
    expect(stats.openEpochs).toBe(1);
    expect(stats.prizesPaid).toBe(1);
    expect(stats.cupsClosed).toBe(1);
    expect(stats.operatorStepFailures).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.warnings).toBe(3);
  });

  it("groups failures that differ only in numbers and keys", () => {
    const stats = parseLog(text);
    expect(stats.topFailures[0]).toEqual({
      text: "Error: custom program error: #x# at <key>",
      count: 2,
    });
  });

  it("merges several files", () => {
    const a = parseLog(line({ bot: "x", signature: "s", msg: "ping" }));
    const b = parseLog(
      [
        line({ bot: "x", signature: "s", msg: "ping" }),
        line({ level: 40, bot: "y", error: "e", msg: "decision failed" }),
      ].join("\n"),
    );
    const merged = mergeLogStats([a, b]);
    expect(merged.sentByBot).toEqual({ x: 2 });
    expect(merged.failuresByBot).toEqual({ y: 1 });
    expect(merged.lines).toBe(3);
  });

  it("folds numbers out of action names", () => {
    expect(foldAction("settle the Call of seat 4")).toBe("settle the Call of seat #");
  });
});

describe("decodeLogFile", () => {
  it("reads UTF-8, UTF-8 with a BOM and the UTF-16 that PowerShell writes", () => {
    const text = '{"a":1}\n';
    expect(decodeLogFile(Buffer.from(text, "utf8"))).toBe(text);
    expect(decodeLogFile(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]))).toBe(
      text,
    );
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect(decodeLogFile(utf16)).toBe(text);
  });
});

describe("judge", () => {
  const good = () => {
    const tracker = new SoakTracker();
    for (let i = 0; i <= 60; i++) {
      tracker.push(sample(i * 60_000, { roundId: 10 + i, tick: i, armedUntilSlot: 10_000_000 }));
    }
    return tracker.summary();
  };
  const sent = parseLog(
    Array.from({ length: 200 }, () => line({ bot: "b", signature: "s", msg: "ping" })).join("\n"),
  );

  it("passes a healthy hour", () => {
    const verdicts = judge(good(), sent, { minutes: 60 });
    expect(verdicts.every((v) => v.pass)).toBe(true);
  });

  it("fails a short run, a long stall, an unarmed crank, many failures and error lines", () => {
    const tracker = new SoakTracker();
    tracker.push(sample(0));
    tracker.push(sample(5 * 60_000, { tick: 1, slot: 99_999 }));
    const bad = parseLog(
      [
        line({ bot: "b", signature: "s", msg: "ping" }),
        line({ level: 40, bot: "b", error: "e", msg: "decision failed" }),
        line({ level: 50, msg: "x" }),
      ].join("\n"),
    );
    const verdicts = judge(tracker.summary(), bad, { minutes: 60 });
    const failed = verdicts.filter((v) => !v.pass).map((v) => v.name);
    expect(failed).toEqual(
      expect.arrayContaining([
        "the run lasted as long as planned",
        "the crank never ran out",
        "failed steps stay under 2% of the transactions sent",
        "no error-level log lines",
      ]),
    );
  });
});
