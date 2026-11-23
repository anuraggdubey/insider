import { utils } from "@anchor-lang/core";
import { expect, it } from "vitest";
import { decodeAccount, previewOrder } from "../src";
import { createFixture } from "../../app/src/lib/fixture";
import { leakEdge } from "../../app/src/lib/leak-edge";
import vectors from "./fixtures/vectors.json";

it("shows impact only for a captured order that has not yet landed", () => {
  const fixture = createFixture();
  const vault = decodeAccount("leakVault", utils.bytes.base64.decode(vectors.raw.leakVault));
  vault.orderCount = 1;
  vault.orders[0] = { seat: 1, lane: 0, sideSize: 1_000, landTick: 30, seq: 0 };
  const result = leakEdge(vault, 20, 40, fixture.snapshot.market, 10);
  const expected = previewOrder({ base: 50_000n, quote: 50_000n }, 1_000, { feeBps: 10 });
  expect(result).toMatchObject({ ticksLeft: 20, impactBps: expected.impactBps });
  expect(leakEdge(vault, 30, 40, fixture.snapshot.market, 10).impactBps).toBeNull();
  expect(leakEdge(vault, 41, 40, fixture.snapshot.market, 10).ticksLeft).toBe(0);
});
