import { describe, expect, it } from "vitest";
import { createFixture, fixtureTick } from "../../app/src/lib/fixture";
import { createRoundObserver } from "../../app/src/lib/xray-archive";
import {
  payloadOrders,
  publicPayload,
  roundSeats,
  sandwichOrders,
  shareDetails,
  tagLeak,
} from "../../app/src/lib/xray-data";

describe("X-ray replay data", () => {
  it("resolves a sandwich and highlights only orders contained in the payload", () => {
    const fixture = createFixture();
    const observe = createRoundObserver(true, null);
    for (let i = 0; i < 180; i++) {
      fixtureTick(fixture);
      observe(fixture.snapshot);
    }
    fixtureTick(fixture);
    const round = observe(fixture.snapshot)!;
    const tag = round.xray.tags[0]!;
    const triple = sandwichOrders(tag, round.xray.orders)!;
    expect(triple.front.landTick).toBeLessThan(triple.victim.landTick);
    expect(triple.exit.landTick).toBeGreaterThan(triple.victim.landTick);
    const leak = tagLeak(round, tag)!;
    expect(payloadOrders(leak, triple.victim)).toBe(true);
    expect(payloadOrders(leak, triple.front)).toBe(false);
    const carried = {
      ...triple.victim,
      scheduledTick: triple.victim.landTick,
      landTick: triple.victim.landTick + 2,
    };
    expect(payloadOrders(leak, carried)).toBe(true);
    expect(payloadOrders(leak, { ...carried, scheduledTick: carried.scheduledTick + 1 })).toBe(
      false,
    );
    const legacy = { ...triple.victim, scheduledTick: undefined };
    expect(payloadOrders(leak, legacy)).toBe(true);
    const flow = {
      ...leak,
      header: { ...leak.header, kind: 0 },
      fields: [0, 0, carried.scheduledTick, carried.scheduledTick],
    };
    expect(payloadOrders(flow, carried)).toBe(true);
    expect(publicPayload(round, leak).join(" ")).toContain("BUY");
    expect(shareDetails(round).line).toContain("INSIDER round 1");
    expect(shareDetails(round).pnl).toBe(round.xray.scores![tag.front]);
    expect(shareDetails(round).seat).toBe(round.seats[tag.front]!.name);
    const onChain = roundSeats(round)[tag.front]!;
    round.seats[tag.front]!.name = "Changed later";
    round.seats[tag.front]!.score = 999;
    expect(roundSeats(round)[tag.front]).toEqual(onChain);
    expect(shareDetails(round).seat).toBe(onChain.name);
    expect(shareDetails(round).pnl).toBe(onChain.score);
    expect(sandwichOrders(tag, [triple.front, triple.victim])).toBeNull();
    round.xray.tags = [];
    const winner = roundSeats(round)
      .filter((item) => !item.free)
      .sort((a, b) => b.score! - a.score!)[0]!;
    expect(shareDetails(round).seat).toBe(winner.name);
    expect(shareDetails(round).pnl).toBe(winner.score);
  });
});
