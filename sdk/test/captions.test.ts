import { describe, expect, it } from "vitest";
import { deriveTable } from "../src";
import { createFixture, fixtureTick } from "../../app/src/lib/fixture";
import { cameraEvent, caption } from "../../app/src/lib/captions";

describe("broadcast captions", () => {
  it("uses deterministic public-event templates", () => {
    expect(caption({ kind: "priority", tick: 1, name: "Bold Lynx", count: 3, fee: 3 })).toBe(
      "Bold Lynx just paid 3 chips to jump the line.",
    );
    expect(
      caption({
        kind: "fill",
        tick: 1,
        name: "Whale",
        seat: 255,
        side: 1,
        size: 2_500,
        price: 1_000_000,
      }),
    ).toBe("A whale bought 2,500 units. The pool noticed.");
  });
  it("selects the largest current public fill and ignores stale events", () => {
    const fixture = createFixture();
    for (let i = 0; i < 45; i++) fixtureTick(fixture);
    const view = deriveTable(fixture.snapshot);
    const selected = cameraEvent(view, fixture.snapshot);
    expect(selected).toMatchObject({ kind: "fill", seat: 255, size: 1800 });
    fixture.snapshot.table.tick = 100;
    expect(cameraEvent(deriveTable(fixture.snapshot), fixture.snapshot)).toBeNull();
  });
});
