import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { createFixture, fixtureSend, fixtureTick } from "../../app/src/lib/fixture";
import {
  createRoundObserver,
  findRound,
  loadRounds,
  saveRound,
} from "../../app/src/lib/xray-archive";
import { roundSeats } from "../../app/src/lib/xray-data";

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
  it("archives finalized on-chain scores and identities even when close-out was not observed", () => {
    const store = memoryStorage();
    const fixture = createFixture();
    const snapshot = fixture.snapshot;
    const observe = createRoundObserver(true, store);
    expect(observe(snapshot)).toBeNull();
    snapshot.xray!.seatOwners = snapshot.seats.map((seat) => seat.owner);
    snapshot.xray!.scores[0] = 250;
    snapshot.xray!.nameIdx[0] = 2;
    snapshot.xray!.seatKinds[0] = 1;
    snapshot.xray!.finalized = 1;
    snapshot.seats[0]!.owner = PublicKey.default;
    const archived = observe(snapshot)!;
    expect(archived.seats[0]!.score).toBe(250);
    expect(archived.seats[0]!.name).toBe("Silver Fox");
    expect(archived.seats[0]!.kind).toBe("ai");
    expect(archived.seats[0]!.free).toBe(false);
    expect(archived.seats[7]!.score).toBe(0);
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

  it("keeps older snapshots without on-chain score fields", () => {
    const store = memoryStorage();
    const fixture = createFixture();
    for (let i = 0; i < 181; i++) fixtureTick(fixture);
    const round = createRoundObserver(true, store)(fixture.snapshot)!;
    delete round.xray.seatOwners;
    delete round.xray.scores;
    delete round.xray.seatKinds;
    delete round.xray.nameIdx;
    delete round.xray.seatPad;
    round.seats[0]!.score = null;
    store.setItem("insider:xray:fixture:v1", JSON.stringify([round]));
    const legacy = findRound(true, round.authority, round.round, store)!;
    expect(legacy.xray.scores).toBeUndefined();
    expect(roundSeats(legacy)).toEqual(legacy.seats);
    expect(roundSeats(legacy)[0]!.score).toBeNull();
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
    const before = BigInt(fixture.snapshot.seats[0]!.chips.toString());
    fixtureSend(fixture, 0, 50, 1);
    expect(BigInt(fixture.snapshot.seats[0]!.chips.toString())).toBe(before - 3n);
    for (let i = 0; i < 180; i++) {
      fixtureTick(fixture);
    }
    expect(fixture.snapshot.xray!.finalized).toBe(0);
    expect(fixture.snapshot.seats.every((seat) => seat.position === 0)).toBe(true);
    const scores = fixture.snapshot.seats.map((seat) =>
      seat.owner.equals(PublicKey.default) ? 0 : Number(BigInt(seat.chips.toString()) - 1_000n),
    );
    fixtureTick(fixture);
    const round = createRoundObserver(true, store)(fixture.snapshot)!;
    expect(round.xray.scores).toEqual(scores);
    expect(roundSeats(round).map((seat) => seat.score)).toEqual(scores);
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
