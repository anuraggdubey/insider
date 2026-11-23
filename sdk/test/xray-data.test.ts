import { describe, expect, it } from "vitest";
import { createFixture, fixtureTick } from "../../app/src/lib/fixture";
import { createRoundObserver } from "../../app/src/lib/xray-archive";
import {
  payloadOrders,
  publicPayload,
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
    expect(publicPayload(round, leak).join(" ")).toContain("BUY");
    expect(shareDetails(round).line).toContain("INSIDER round 1");
    expect(sandwichOrders(tag, [triple.front, triple.victim])).toBeNull();
  });
});
