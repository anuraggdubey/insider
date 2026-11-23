import { BN } from "@anchor-lang/core";
import { describe, expect, it } from "vitest";
import { createFixture, fixtureSend, fixtureTick } from "../../app/src/lib/fixture";
import {
  createRoundObserver,
  findRound,
  loadRounds,
  saveRound,
} from "../../app/src/lib/xray-archive";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("X-ray archive", () => {
  it("archives only finalized matching rounds, preserving the witnessed close-out scores", () => {
    const store = memoryStorage();
    const fixture = createFixture();
    const snapshot = fixture.snapshot;
    const observe = createRoundObserver(true, store);
    expect(observe(snapshot)).toBeNull();
    snapshot.table.tick = 180;
    snapshot.market.lastTick = 180;
    snapshot.seats.forEach((seat) => {
      seat.position = 0;
    });
    snapshot.seats[0]!.chips = new BN(1_250);
    expect(observe(snapshot)).toBeNull();
    snapshot.seats[0]!.chips = new BN(1_000);
    snapshot.xray!.finalized = 1;
    const archived = observe(snapshot)!;
    expect(archived.seats[0]!.score).toBe(250);
    expect(archived.seats[7]!.score).toBeNull();
    expect(archived.fixture).toBe(true);
    expect(findRound(false, undefined, undefined, store)).toBeNull();
    expect(findRound(true, archived.authority, 1, store)).toEqual(archived);
    snapshot.market.history[0] = 123;
    expect(archived.history[0]).toBe(1_000_000);
    createRoundObserver(true, store)(snapshot);
    expect(findRound(true, archived.authority, 1, store)!.seats[0]!.score).toBe(250);
    snapshot.board.roundId = 2;
    expect(observe(snapshot)).toBeNull();
  });

  it("caps snapshots, keeps latest first, and tolerates corrupt or unavailable storage", () => {
    const store = memoryStorage();
    const snapshot = createFixture().snapshot;
    snapshot.xray!.finalized = 1;
    const observe = createRoundObserver(false, store);
    for (let round = 1; round <= 31; round++) {
      snapshot.table.roundId = round;
      snapshot.board.roundId = round;
      snapshot.market.roundId = round;
      snapshot.xray!.roundId = round;
      observe(snapshot);
    }
    const rounds = loadRounds(false, store);
    expect(rounds).toHaveLength(30);
    expect(rounds[0]!.round).toBe(31);
    expect(rounds.at(-1)!.round).toBe(2);
    expect(findRound(false, rounds[0]!.authority, 1, store)).toBeNull();
    saveRound(rounds.at(-1)!, store);
    expect(findRound(false, rounds[0]!.authority, undefined, store)!.round).toBe(31);
    expect(
      saveRound(rounds[0]!, {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).toBe(false);
    store.setItem("insider:xray:v1", "{bad");
    expect(loadRounds(false, store)).toEqual([]);
  });

  it("drives the fixture through close-out, finalization and a trace-backed sandwich", () => {
    const store = memoryStorage();
    const fixture = createFixture();
    const observe = createRoundObserver(true, store);
    const before = BigInt(fixture.snapshot.seats[0]!.chips.toString());
    fixtureSend(fixture, 0, 50, 1);
    expect(BigInt(fixture.snapshot.seats[0]!.chips.toString())).toBe(before - 3n);
    for (let i = 0; i < 180; i++) {
      fixtureTick(fixture);
      observe(fixture.snapshot);
    }
    expect(fixture.snapshot.xray!.finalized).toBe(0);
    expect(fixture.snapshot.seats.every((seat) => seat.position === 0)).toBe(true);
    fixtureTick(fixture);
    const round = observe(fixture.snapshot)!;
    expect(round.xray.finalized).toBe(1);
    expect(round.xray.leaks.length).toBeGreaterThan(0);
    expect(round.xray.tags.length).toBe(1);
    const tag = round.xray.tags[0]!;
    expect(
      round.xray.orders.some(
        (order) => order.seat === tag.front && order.landTick === tag.frontTick,
      ),
    ).toBe(true);
    expect(
      round.xray.orders.some(
        (order) => order.seat === tag.victim && order.landTick === tag.victimTick,
      ),
    ).toBe(true);
    expect(round.seats[0]!.score).not.toBeNull();
    expect(findRound(true, round.authority, round.round, store)).toEqual(round);
  });
});
