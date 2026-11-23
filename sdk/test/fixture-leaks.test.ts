import { utils } from "@anchor-lang/core";
import { describe, expect, it } from "vitest";
import { arbPull, decodeAccount, vammPrice, WHALE_SEAT } from "../src/index";
import {
  buildFixturePayload,
  makeFixtureDrop,
  type FixtureDrop,
  type FixtureOrder,
} from "../../app/src/lib/fixture-leaks";
import { createFixture, fixtureBid, fixtureTick } from "../../app/src/lib/fixture";
import vectors from "./fixtures/vectors.json";

const vault = () => decodeAccount("leakVault", utils.bytes.base64.decode(vectors.raw.leakVault));
const path = Array.from({ length: 192 }, (_, i) => 1_000_000 + i * 1000);
const orders: FixtureOrder[] = [
  { id: "1", seat: WHALE_SEAT, lane: 0, sideSize: 900, sentTick: 5, landTick: 25, round: 1 },
  { id: "2", seat: 1, lane: 0, sideSize: 200, sentTick: 0, landTick: 20, round: 1 },
  { id: "3", seat: 2, lane: 0, sideSize: -400, sentTick: 2, landTick: 22, round: 1 },
  { id: "4", seat: 3, lane: 0, sideSize: 400, sentTick: 2, landTick: 22, round: 1 },
];
const spec = (kind: number, offset = 20, tick = 10): FixtureDrop => ({
  tick,
  kind,
  rarity: 0,
  offset,
  length: kind === 0 ? 10 : 0,
});

describe("fixture leak seeding and payloads", () => {
  it("sells at the floor on the last accepted tick and expires on the next", () => {
    const fixture = createFixture();
    for (let i = 0; i < 21; i++) fixtureTick(fixture);
    fixtureBid(fixture, 7, 0);
    expect(fixture.snapshot.board.headers[0]!.paid).toBe(1);
    const expired = createFixture();
    for (let i = 0; i < 22; i++) fixtureTick(expired);
    expect(() => fixtureBid(expired, 7, 0)).toThrow("Auction has ended.");
  });
  it("maps weighted rarity and equal family choices to valid kinds and offsets", () => {
    const counts = [0, 0, 0];
    for (let roll = 0; roll < 100; roll++)
      for (let family = 0; family < 2; family++) {
        const values = [roll, family, 0, 0];
        const drop = makeFixtureDrop(10, () => values.shift()!);
        counts[drop.rarity]!++;
        const allowed =
          drop.rarity === 0
            ? family === 0
              ? [0]
              : [4, 5]
            : drop.rarity === 1
              ? family === 0
                ? [1, 2]
                : [6]
              : family === 0
                ? [3]
                : [7];
        expect(allowed).toContain(drop.kind);
        if (drop.kind === 0) expect(drop.offset).toBeGreaterThanOrEqual(2);
        if (drop.kind === 4) expect(drop.offset).toBeGreaterThanOrEqual(10);
        if (drop.kind === 5) expect(drop.offset).toBeGreaterThanOrEqual(20);
      }
    expect(counts).toEqual([130, 60, 10]);
    for (const [roll, kind, expected] of [
      [0, 0, 12],
      [0, 4, 30],
      [0, 5, 40],
    ] as const) {
      const values = kind === 0 ? [roll, 0, 10] : [roll, 1, kind === 4 ? 0 : 1, 20];
      expect(makeFixtureDrop(10, () => values.shift()!).offset).toBe(expected);
    }
    for (const [roll, family, subchoice, expected] of [
      [0, 1, 0, 4],
      [0, 1, 1, 5],
      [65, 0, 0, 1],
      [65, 0, 1, 2],
      [65, 1, 0, 6],
      [95, 0, 0, 3],
      [95, 1, 0, 7],
    ]) {
      const values = [roll!, family!, subchoice!, 0];
      expect(makeFixtureDrop(10, () => values.shift()!).kind).toBe(expected);
    }
  });

  it("builds each payload from the pending queue and private path with Rust's windows", () => {
    let v = vault();
    expect(buildFixturePayload(spec(0, 2), orders, path, [], v)).toEqual({
      windowStart: 12,
      windowEnd: 21,
    });
    expect(v.fields).toEqual([200, 1, 12, 21, 0, 0]);
    v = vault();
    expect(buildFixturePayload(spec(1), orders, path, [], v)).toEqual({
      windowStart: 11,
      windowEnd: 22,
    });
    expect(v.orders[0]).toMatchObject({ seat: 2, sideSize: -400, seq: 3 });
    v = vault();
    expect(buildFixturePayload(spec(2), orders, path, [], v)).toEqual({
      windowStart: 11,
      windowEnd: 25,
    });
    expect(v.orders[0]).toMatchObject({ seat: WHALE_SEAT, landTick: 25 });
    v = vault();
    expect(buildFixturePayload(spec(3), orders, path, [], v)).toEqual({
      windowStart: 11,
      windowEnd: 25,
    });
    expect(v.orders.slice(0, v.orderCount).map((o) => o.seat)).toEqual([1, 2, 3, WHALE_SEAT]);
    v = vault();
    expect(buildFixturePayload(spec(4), orders, path, [], v)).toEqual({
      windowStart: 30,
      windowEnd: 30,
    });
    expect(v.fields.slice(0, 2)).toEqual([30, path[30]]);
    v = vault();
    expect(buildFixturePayload(spec(5), orders, path, [], v)).toEqual({
      windowStart: 11,
      windowEnd: 30,
    });
    expect(v.fields.slice(0, 4)).toEqual([10, 30, 1, 1]);
    v = vault();
    expect(buildFixturePayload(spec(6), orders, path, [{ tick: 20, bps: -100 }], v)).toEqual({
      windowStart: 11,
      windowEnd: 50,
    });
    expect(v.fields.slice(0, 4)).toEqual([1, 20, -1, 50]);
    v = vault();
    expect(buildFixturePayload(spec(7), orders, path, [], v)).toEqual({
      windowStart: 11,
      windowEnd: 70,
    });
    expect(v.fields).toEqual([path[70], 70, path[11], 11, 11, 70]);
    for (const kind of [1, 2, 3]) {
      v = vault();
      expect(buildFixturePayload(spec(kind), [], path, [], v)).toEqual({
        windowStart: 11,
        windowEnd: 30,
      });
      expect(v.orderCount).toBe(0);
    }
    v = vault();
    buildFixturePayload(spec(6), orders, path, [], v);
    expect(v.fields).toEqual([0, 0, 0, 50, 0, 0]);
    v = vault();
    const manyOrders = Array.from({ length: 40 }, (_, i) => ({
      ...orders[1]!,
      id: `${40 - i}`,
      seat: i % 10,
      landTick: 11 + i,
    }));
    buildFixturePayload(spec(3), manyOrders, path, [], v);
    expect(v.orderCount).toBe(32);
    expect(v.orders.slice(0, 32).map((o) => o.landTick)).toEqual(
      Array.from({ length: 32 }, (_, i) => 11 + i),
    );
    for (const kind of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const window = buildFixturePayload(spec(kind, 20, 175), [], path, [], vault());
      expect(window.windowEnd).toBeLessThanOrEqual(179);
      expect(window.windowStart).toBeLessThanOrEqual(179);
    }
  });

  it("uses the scheduled rarity prices and actual fixture fundamental path", () => {
    const fixture = createFixture();
    expect(fixture.snapshot.table.params.priorityFee).toBe(3);
    const initial = { base: BigInt(50_000), quote: BigInt(50_000) };
    const expectedArb = arbPull(initial, fixture.path[1]!, fixture.snapshot.table.params.arbBps);
    fixtureTick(fixture);
    expect(fixture.snapshot.market.price).toBe(vammPrice(expectedArb));
    for (let i = 1; i < 10; i++) fixtureTick(fixture);
    const pin = fixture.snapshot.board.headers.find((h) => h.state === 1)!;
    expect(pin).toMatchObject({ kind: 4, rarity: 0, startPrice: 8, floorPrice: 1 });
    expect(fixture.vaults[0]!.fields[1]).toBe(fixture.path[pin.windowEnd]);
    for (let i = 10; i < 30; i++) fixtureTick(fixture);
    const rare = fixture.snapshot.board.headers.find((h) => h.state === 1)!;
    expect(rare).toMatchObject({ kind: 1, rarity: 1, startPrice: 20, floorPrice: 2 });
    const largest = fixture.queue
      .filter((order) => order.seat !== WHALE_SEAT)
      .sort(
        (a, b) => Math.abs(b.sideSize) - Math.abs(a.sideSize) || Number(a.id) - Number(b.id),
      )[0]!;
    const rareVault = fixture.vaults[fixture.snapshot.board.headers.indexOf(rare)]!;
    expect(rareVault.orders[0]).toMatchObject({
      seat: largest.seat,
      sideSize: largest.sideSize,
      landTick: largest.landTick,
    });
    expect(rare.windowEnd).toBe(largest.landTick);
    for (let i = 30; i < 90; i++) fixtureTick(fixture);
    const flow = fixture.snapshot.board.headers.find((header) => header.mintedTick === 90)!;
    expect(flow.kind).toBe(0);
    const flowVault = fixture.vaults[fixture.snapshot.board.headers.indexOf(flow)]!;
    const inWindow = fixture.queue.filter(
      (order) => order.landTick >= flow.windowStart && order.landTick <= flow.windowEnd,
    );
    expect(flowVault.fields.slice(0, 4)).toEqual([
      inWindow.reduce((total, order) => total + order.sideSize, 0),
      inWindow.length,
      flow.windowStart,
      flow.windowEnd,
    ]);
  });

  it("uses the engine Epic price", () => {
    const fixture = createFixture();
    fixture.drops = [{ ...spec(3, 0, 10), rarity: 2 }];
    for (let i = 0; i < 10; i++) fixtureTick(fixture);
    expect(fixture.snapshot.board.headers.find((h) => h.state === 1)).toMatchObject({
      rarity: 2,
      startPrice: 60,
      floorPrice: 6,
    });
  });
});
