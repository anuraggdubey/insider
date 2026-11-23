import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { deriveTable, type TableView } from "../src";
import { createFixture, fixtureClaim } from "../../app/src/lib/fixture";
import { draftForFill } from "../../app/src/lib/order-prefill";

describe("feed order prefills", () => {
  const fill: Extract<TableView["feed"][number], { type: "fill" }> = {
    type: "fill",
    tick: 5,
    seat: 2,
    side: 1,
    size: 2_500,
    price: 1_000_000,
    order: 0,
  };
  it("copies or fades a fill without exceeding order and projected position limits", () => {
    const fixture = createFixture();
    const key = new PublicKey(new Uint8Array(32).fill(99));
    fixtureClaim(fixture, key, 7);
    fixture.snapshot.seats[7]!.position = 4_800;
    const view = deriveTable(fixture.snapshot, {
      me: key,
      pending: [{ id: "x", sideSize: 100, lane: 0, sentTick: 0, landTick: 20, round: 1 }],
    });
    expect(draftForFill(fill, view, fixture.snapshot.table.params, false)).toEqual({
      side: "buy",
      size: 100,
    });
    expect(draftForFill(fill, view, fixture.snapshot.table.params, true)).toEqual({
      side: "sell",
      size: 2_000,
    });
  });
  it("does not invent the side or size of a sealed send or allow a draft without a seat", () => {
    const fixture = createFixture();
    const view = deriveTable(fixture.snapshot);
    expect(draftForFill(null, view, fixture.snapshot.table.params, false)).toBeNull();
    expect(draftForFill(fill, view, fixture.snapshot.table.params, false)).toBeNull();
  });
});
