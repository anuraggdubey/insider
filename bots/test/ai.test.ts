import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

import { AnalystDriver, type AnalystDeps, type AnalystState } from "../src/ai/analyst.js";
import {
  BIG_FILL_UNITS,
  CaptionFeed,
  Commentator,
  diffEvents,
  type Snapshot,
} from "../src/ai/commentary.js";
import { PriceHistory } from "../src/ai/market-data.js";
import {
  AnthropicPredictor,
  HeuristicPredictor,
  describeInput,
  parseDecision,
  type Decision,
  type Predictor,
} from "../src/ai/predictor.js";
import { takeSnapshot } from "../src/ai/snapshot.js";

describe("PriceHistory", () => {
  it("keeps one sample per gap, a rolling window, and summarises the moves", () => {
    const history = new PriceHistory(10 * 60_000, 5_000);
    expect(history.add(0, 100)).toBe(true);
    expect(history.add(2_000, 101)).toBe(false);
    for (let i = 1; i <= 12; i++) history.add(i * 60_000, 100 + i);
    const summary = history.summary(12 * 60_000)!;
    expect(summary.usd).toBe(112);
    expect(summary.change1m).toBeCloseTo((1 / 111) * 100, 5);
    expect(summary.high15m).toBe(112);
    // samples older than ten minutes were dropped
    expect(summary.low15m).toBe(102);
  });

  it("has no summary before the first sample and no change with one sample", () => {
    const history = new PriceHistory();
    expect(history.summary(0)).toBeUndefined();
    history.add(0, 70);
    expect(history.summary(1_000)).toMatchObject({ usd: 70, change1m: 0, change5m: 0 });
  });
});

describe("parseDecision", () => {
  it("reads a clean answer and the nearest allowed horizon", () => {
    expect(
      parseDecision(
        '{"direction":"up","horizon":100,"stake":40,"confidence":70,"reason":"momentum"}',
        500,
      ),
    ).toEqual({
      direction: 1,
      horizon: 120,
      stake: 40,
      confidence: 70,
      reason: "momentum",
    });
    expect(parseDecision('Sure! {"direction":"DOWN","horizon":"180"} done', 500)).toMatchObject({
      direction: -1,
      horizon: 180,
      stake: 30,
    });
  });

  it("clamps the stake to what the program accepts and to the chips available", () => {
    expect(parseDecision('{"direction":1,"stake":9000}', 500)?.stake).toBe(100);
    expect(parseDecision('{"direction":1,"stake":10}', 500)?.stake).toBe(10);
    expect(parseDecision('{"direction":1,"stake":80}', 45)?.stake).toBe(45);
    // not enough chips for the smallest Call: no call
    expect(parseDecision('{"direction":1,"stake":80}', 9)).toBeUndefined();
  });

  it("treats skips, noise and unclear directions as no call", () => {
    expect(parseDecision('{"skip":true}', 500)).toBeUndefined();
    expect(parseDecision("I cannot say", 500)).toBeUndefined();
    expect(parseDecision("{not json}", 500)).toBeUndefined();
    expect(parseDecision('{"direction":"sideways"}', 500)).toBeUndefined();
    expect(parseDecision('{"horizon":60}', 500)).toBeUndefined();
  });
});

describe("predictors", () => {
  const input = {
    summary: {
      usd: 70,
      change1m: 0.2,
      change5m: 0.5,
      change15m: 1,
      high15m: 71,
      low15m: 69,
      samples: 30,
    },
    record: { calls: 4, hits: 3, streak: 2, profit: 80 },
    chips: 400,
  };

  it("describes only public data", () => {
    const text = describeInput(input);
    expect(text).toContain("SOL/USD now: 70.00");
    expect(text).toContain("your record: 4 calls, 3 right (75%)");
    expect(text.toLowerCase()).not.toMatch(/seat|mempool|vault|leak/);
  });

  it("asks the model with the persona prompt and parses the answer", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"direction":"down","horizon":60,"stake":25,"confidence":60,"reason":"stretched"}',
        },
      ],
    });
    const predictor = new AnthropicPredictor("contrarian", "key", "model-x", {
      messages: { create },
    } as never);
    const decision = await predictor.predict(input);
    expect(decision).toMatchObject({ direction: -1, stake: 25 });
    const call = create.mock.calls[0]![0];
    expect(call.model).toBe("model-x");
    expect(call.system).toContain("Contrarian");
    expect(call.messages[0].content).toContain("SOL/USD now");
  });

  it("lets an unreachable model throw so the analyst mints nothing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection refused"));
    const predictor = new AnthropicPredictor("claude", "key", "m", {
      messages: { create },
    } as never);
    await expect(predictor.predict(input)).rejects.toThrow("connection refused");
  });

  it("the heuristic follows the trend, the contrarian version fades it, neither acts on a flat market", async () => {
    expect((await new HeuristicPredictor().predict(input))?.direction).toBe(1);
    expect((await new HeuristicPredictor(true).predict(input))?.direction).toBe(-1);
    const flat = { ...input, summary: { ...input.summary, change1m: 0, change5m: 0 } };
    expect(await new HeuristicPredictor().predict(flat)).toBeUndefined();
  });
});

describe("AnalystDriver", () => {
  const decision: Decision = {
    direction: 1,
    horizon: 60,
    stake: 30,
    confidence: 60,
    reason: "test",
  };
  const state = (patch: Partial<AnalystState> = {}): AnalystState => ({
    owned: true,
    deskChips: 800,
    hasOpenCall: false,
    record: { calls: 0, hits: 0, streak: 0, profit: 0 },
    ...patch,
  });
  const setup = (predictor: Predictor | undefined, price: number | null = 70) => {
    let now = 1_000_000;
    const minted: Decision[] = [];
    const warn = vi.fn();
    const deps: AnalystDeps = {
      now: () => now,
      readPrice: async () => price ?? undefined,
      mint: async (d) => void minted.push(d),
      log: { info: vi.fn(), warn },
    };
    const driver = new AnalystDriver(predictor, deps, {
      minSamples: 3,
      cooldownMs: 90_000,
      backoffMs: 60_000,
    });
    const advance = (ms: number) => (now += ms);
    return { driver, minted, warn, advance };
  };
  const model = (impl: () => Promise<Decision | undefined>): Predictor => ({
    name: "fake",
    predict: impl,
  });

  it("watches the market first, then mints a Call, then waits out the cooldown", async () => {
    const { driver, minted, advance } = setup(model(async () => decision));
    expect(await driver.tick(state())).toBe("warming-up");
    advance(6_000);
    expect(await driver.tick(state())).toBe("warming-up");
    advance(6_000);
    expect(await driver.tick(state())).toBe("minted");
    expect(minted).toEqual([decision]);
    advance(10_000);
    expect(await driver.tick(state())).toBe("cooldown");
    advance(90_000);
    expect(await driver.tick(state())).toBe("minted");
  });

  it("mints nothing without a model, a seat, chips or while a Call is open", async () => {
    const none = setup(undefined);
    expect(await none.driver.tick(state())).toBe("no-model");
    const { driver, minted, advance } = setup(model(async () => decision));
    for (let i = 0; i < 2; i++) {
      await driver.tick(state());
      advance(6_000);
    }
    expect(await driver.tick(state({ owned: false }))).toBe("not-seated");
    expect(await driver.tick(state({ hasOpenCall: true }))).toBe("open-call");
    expect(await driver.tick(state({ deskChips: 105 }))).toBe("low-chips");
    expect(minted).toEqual([]);
  });

  it("when the model is unreachable it mints nothing, says so, and retries after the back-off", async () => {
    let up = false;
    const { driver, minted, warn, advance } = setup(
      model(async () => {
        if (!up) throw new Error("API unreachable");
        return decision;
      }),
    );
    for (let i = 0; i < 2; i++) {
      await driver.tick(state());
      advance(6_000);
    }
    expect(await driver.tick(state())).toBe("model-unavailable");
    expect(warn).toHaveBeenCalledOnce();
    expect(minted).toEqual([]);
    advance(30_000);
    up = true;
    expect(await driver.tick(state())).toBe("cooldown");
    advance(61_000);
    expect(await driver.tick(state())).toBe("minted");
  });

  it("does not ask again at once when the model sees no edge", async () => {
    const ask = vi.fn().mockResolvedValue(undefined);
    const { driver, advance } = setup(model(ask));
    for (let i = 0; i < 2; i++) {
      await driver.tick(state());
      advance(6_000);
    }
    expect(await driver.tick(state())).toBe("no-edge");
    expect(await driver.tick(state())).toBe("cooldown");
    expect(ask).toHaveBeenCalledOnce();
  });

  it("keeps collecting prices when the feed hiccups", async () => {
    const { driver, advance } = setup(
      model(async () => decision),
      null,
    );
    expect(await driver.tick(state())).toBe("warming-up");
    advance(6_000);
    expect(driver.history.length).toBe(0);
  });
});

const snapshot = (patch: Partial<Snapshot> = {}): Snapshot => ({
  roundId: 5,
  phase: "live",
  names: ["Silent Bear", "Clever Badger", undefined],
  leaks: Array.from({ length: 2 }, (_, i) => ({
    leakId: i + 1,
    kind: 2,
    rarity: 0,
    state: 1,
    ownerSeat: 254,
    paid: 0,
    ask: 0,
    licenseAsk: 0,
    readerCount: 0,
  })),
  calls: [],
  fills: [],
  xray: { roundId: 4, finalized: true, tagCount: 0, topSeat: -1, topScore: 0 },
  ...patch,
});

describe("diffEvents", () => {
  it("says nothing on the first look or when nothing changed", () => {
    expect(diffEvents(undefined, snapshot())).toEqual([]);
    expect(diffEvents(snapshot(), snapshot())).toEqual([]);
  });

  it("follows a Leak from auction to sale, listing, flip, opening and licence", () => {
    const base = snapshot();
    const owned = snapshot({
      leaks: [{ ...base.leaks[0]!, state: 2, ownerSeat: 0, paid: 8 }, base.leaks[1]!],
    });
    expect(diffEvents(base, owned)).toEqual([
      { kind: "leak-bought", text: "Silent Bear won the common Whale Leak for 8 chips. Sealed." },
    ]);
    const listed = snapshot({ leaks: [{ ...owned.leaks[0]!, state: 3, ask: 14 }, base.leaks[1]!] });
    expect(diffEvents(owned, listed)[0]).toMatchObject({ kind: "leak-listed" });
    const flipped = snapshot({
      leaks: [{ ...listed.leaks[0]!, state: 2, ownerSeat: 1 }, base.leaks[1]!],
    });
    expect(diffEvents(listed, flipped)[0]).toMatchObject({ kind: "leak-flipped" });
    const opened = snapshot({
      leaks: [{ ...flipped.leaks[0]!, state: 4, readerCount: 1 }, base.leaks[1]!],
    });
    expect(diffEvents(flipped, opened)[0]).toMatchObject({ kind: "leak-opened" });
    const licensed = snapshot({ leaks: [{ ...opened.leaks[0]!, readerCount: 2 }, base.leaks[1]!] });
    expect(diffEvents(opened, licensed)[0]).toMatchObject({ kind: "license-sold" });
  });

  it("announces a new round, its drops, and the scored round with sandwiches", () => {
    const before = snapshot({ phase: "idle", roundId: 5 });
    const live = snapshot({ phase: "live", roundId: 6 });
    const events = diffEvents(before, live);
    expect(events.map((e) => e.kind)).toEqual(["round-start", "leak-drop", "leak-drop"]);
    const ended = snapshot({
      xray: { roundId: 6, finalized: true, tagCount: 2, topSeat: 1, topScore: 40 },
    });
    const wrap = diffEvents(
      snapshot({ xray: { roundId: 5, finalized: true, tagCount: 0, topSeat: -1, topScore: 0 } }),
      ended,
    );
    expect(wrap.map((e) => e.text)).toEqual([
      "Round 6 is scored. Clever Badger led the round with +40.",
      "The X-ray caught 2 sandwiches in round 6.",
    ]);
  });

  it("reports Desk Calls when minted (direction sealed) and when judged (direction revealed)", () => {
    const call = { callId: 3, author: 0, state: 1, mintedUsd: 70.5, horizon: 60, revealedDir: 0 };
    const minted = diffEvents(snapshot(), snapshot({ calls: [call] }));
    expect(minted[0]!.text).toBe(
      "Silent Bear committed a 60s Call on SOL at $70.50. Direction sealed.",
    );
    expect(minted[0]!.text).not.toMatch(/up|down/);
    const right = diffEvents(
      snapshot({ calls: [call] }),
      snapshot({ calls: [{ ...call, state: 2, revealedDir: 1 }] }),
    );
    expect(right[0]).toEqual({
      kind: "call-judged",
      text: "Silent Bear called it: SOL up. The oracle agrees.",
    });
    const wrong = diffEvents(
      snapshot({ calls: [call] }),
      snapshot({ calls: [{ ...call, state: 3, revealedDir: -1 }] }),
    );
    expect(wrong[0]!.text).toContain("the oracle disagrees");
  });

  it("only the big fills make the news, each once", () => {
    const small = { n: 1, seat: 0, side: 1, size: 60, price: 1 };
    const big = { n: 2, seat: 1, side: -1, size: BIG_FILL_UNITS, price: 0.9876 };
    const next = snapshot({ fills: [small, big] });
    const events = diffEvents(snapshot({ fills: [small] }), next);
    expect(events).toEqual([{ kind: "big-fill", text: "Clever Badger sold 250 units at 0.9876." }]);
    expect(diffEvents(next, next)).toEqual([]);
  });
});

describe("CaptionFeed and Commentator", () => {
  it("keeps the newest captions and serves them since an id", () => {
    const feed = new CaptionFeed(3);
    for (const text of ["a", "b", "c", "d"]) feed.add("x", text, 1);
    expect(feed.since().map((c) => c.text)).toEqual(["b", "c", "d"]);
    expect(feed.since(3).map((c) => c.text)).toEqual(["d"]);
  });

  it("publishes template captions straight away without a model", async () => {
    const feed = new CaptionFeed();
    await new Commentator(feed).push([{ kind: "round-start", text: "Round 7 is live." }]);
    expect(feed.since().map((c) => c.text)).toEqual(["Round 7 is live."]);
  });

  it("with a model, rewords a batch, and pauses (publishing nothing) while it is unreachable", async () => {
    const feed = new CaptionFeed();
    let up = false;
    const commentator = new Commentator(feed, async (texts) => {
      if (!up) throw new Error("down");
      return texts.map((t) => t.toUpperCase());
    });
    await commentator.push([{ kind: "round-start", text: "round 7 is live" }]);
    expect(commentator.isPaused).toBe(true);
    expect(feed.since()).toEqual([]);
    up = true;
    await commentator.flush();
    expect(commentator.isPaused).toBe(false);
    expect(feed.since().map((c) => c.text)).toEqual(["ROUND 7 IS LIVE"]);
  });

  it("drops the oldest events when the model stays down for long", async () => {
    const feed = new CaptionFeed();
    const commentator = new Commentator(
      feed,
      async () => {
        throw new Error("down");
      },
      3,
    );
    for (let i = 0; i < 6; i++) await commentator.push([{ kind: "x", text: `e${i}` } as never]);
    let up = true;
    const recovering = new Commentator(feed, async (t) => (up ? t : t), 3);
    await recovering.push([1, 2, 3, 4, 5].map((i) => ({ kind: "x" as never, text: `e${i}` })));
    expect(feed.since().map((c) => c.text)).toEqual(["e3", "e4", "e5"]);
    up = false;
  });
});

describe("takeSnapshot", () => {
  const owner = Keypair.generate().publicKey;
  it("turns decoded public accounts into names, leaks, Calls, the newest fills and the round winner", () => {
    const fills = Array.from({ length: 64 }, (_, i) => ({
      seat: i % 10,
      side: 1,
      size: i,
      price: 1_000_000 + i,
    }));
    const snap = takeSnapshot({
      table: { roundId: 9, phase: { live: {} } },
      board: {
        roundId: 9,
        headers: [
          {
            leakId: 1,
            kind: 0,
            rarity: 1,
            state: 4,
            ownerSeat: 0,
            paid: 7,
            ask: 0,
            licenseAsk: 5,
            readerCount: 2,
          },
        ],
      },
      calls: [
        {
          callId: 2,
          authorSeat: 1,
          state: 1,
          mintedPrice: 70_250_000,
          horizonSecs: 120,
          revealedDir: 0,
        },
      ],
      tape: { fills, fillsHead: 70 },
      seats: [
        { owner, nameIdx: 3 },
        { owner: PublicKey.default, nameIdx: 0 },
      ],
      xray: { roundId: 8, finalized: 1, tagCount: 1, scores: [25, 0, 90] },
    });
    expect(snap.roundId).toBe(9);
    expect(snap.phase).toBe("live");
    expect(snap.names[1]).toBeUndefined();
    expect(snap.names[0]).toBeTruthy();
    expect(snap.leaks[0]).toMatchObject({ state: 4, licenseAsk: 5, readerCount: 2 });
    expect(snap.calls[0]).toMatchObject({ mintedUsd: 70.25, horizon: 120 });
    // the ring holds 64: entries 6 to 69 are the newest, in order
    expect(snap.fills.map((f) => f.n)).toEqual(Array.from({ length: 64 }, (_, i) => 6 + i));
    expect(snap.fills.at(-1)!.n).toBe(69);
    // the top score only counts for seats that exist
    expect(snap.xray).toMatchObject({
      roundId: 8,
      finalized: true,
      tagCount: 1,
      topSeat: 0,
      topScore: 25,
    });
  });

  it("ignores leaks left over from an older round", () => {
    const snap = takeSnapshot({
      table: { roundId: 10, phase: { idle: {} } },
      board: {
        roundId: 9,
        headers: [
          {
            leakId: 1,
            kind: 0,
            rarity: 0,
            state: 4,
            ownerSeat: 0,
            paid: 1,
            ask: 0,
            licenseAsk: 0,
            readerCount: 1,
          },
        ],
      },
      calls: [],
      tape: { fills: [], fillsHead: 0 },
      seats: [],
      xray: { roundId: 9, finalized: 0, tagCount: 0, scores: [] },
    });
    expect(snap.leaks).toEqual([]);
    expect(snap.xray.finalized).toBe(false);
  });
});
