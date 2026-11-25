import { describe, expect, it } from "vitest";
import { mempoolLanes, stackLaneOrders, type LaneOrder } from "../../app/src/lib/mempool-lanes";

const pending = (id: string, sentTick: number, lane = 0, sideSize = 200) => ({
  id,
  sentTick,
  lane,
  sideSize,
  landTick: sentTick + (lane ? 4 : 20),
  round: 1,
  ticksToLand: 1,
});

describe("mempool lane stacking", () => {
  const order = (key: string, sentTick: number): LaneOrder => ({
    key,
    sentTick,
    seat: 1,
    lane: 0,
    landTick: sentTick + 20,
    mine: false,
  });

  it("places same-tick orders in separate rows at every width", () => {
    const orders = [order("a", 9), order("b", 9), order("c", 9)];
    for (const width of [0, 180, 300, 800]) {
      expect(stackLaneOrders(orders, 10, 20, width).map(({ row }) => row)).toEqual([0, 1, 2]);
    }
  });

  it("shares a row only when the whole capsule and label fit apart", () => {
    const orders = [order("a", 1), order("b", 6), order("c", 11), order("d", 16)];
    expect(stackLaneOrders(orders, 19, 20, 600).map(({ row }) => row)).toEqual([0, 0, 0, 0]);
    expect(stackLaneOrders(orders, 19, 20, 240).map(({ row }) => row)).toEqual([0, 1, 2, 3]);
  });

  it("keeps same-row orders at least one label width apart throughout a tick", () => {
    const orders = Array.from({ length: 20 }, (_, tick) => order(String(tick), tick));
    for (const width of [120, 240, 390, 600, 1024, 1920]) {
      const arranged = stackLaneOrders(orders, 19, 20, width);
      for (const [i, first] of arranged.entries()) {
        for (const second of arranged.slice(i + 1)) {
          if (first.row !== second.row) continue;
          for (const fraction of [0, 0.5, 1]) {
            const x = (sentTick: number) =>
              Math.min(1, Math.max(0, (19 + fraction - sentTick) / 20)) * (width - 104);
            expect(
              Math.abs(x(first.order.sentTick) - x(second.order.sentTick)),
            ).toBeGreaterThanOrEqual(104 - 1e-8);
          }
        }
      }
    }
  });
});
const empty = () => Array.from({ length: 64 }, () => ({ seat: 0, lane: 0, sentTick: 0 }));
const run = (
  sends: { seat: number; lane: number; sentTick: number }[],
  myPending = [pending("a", 9)],
  options: Partial<Parameters<typeof mempoolLanes>[0]> = {},
) =>
  mempoolLanes({
    tape: { sends, sendsHead: sends.length },
    tick: 10,
    phase: "live",
    standardDelay: 20,
    priorityDelay: 4,
    mySeat: 7,
    pending: myPending,
    ...options,
  });

describe("public mempool lanes", () => {
  it("merges each matching public send with exactly one local order", () => {
    const sends = [
      { seat: 7, lane: 0, sentTick: 9 },
      { seat: 7, lane: 0, sentTick: 9 },
      { seat: 2, lane: 0, sentTick: 9 },
    ];
    const result = run(sends);
    expect(result).toHaveLength(3);
    expect(result.filter((item) => item.sideSize === 200)).toHaveLength(1);
    expect(result[1]).toMatchObject({ seat: 7, mine: true });
    expect(result[1]?.sideSize).toBeUndefined();
    expect(result[2]?.sideSize).toBeUndefined();
  });

  it("adds local sends not yet visible in the public ring and matches lane and tick", () => {
    const result = run(
      [
        { seat: 7, lane: 0, sentTick: 8 },
        { seat: 2, lane: 1, sentTick: 9 },
      ],
      [pending("local", 9, 1, -500)],
    );
    expect(result).toHaveLength(3);
    expect(result[2]).toMatchObject({ key: "local-local", sideSize: -500, seat: 7, lane: 1 });
    expect(result[0]?.sideSize).toBeUndefined();
  });

  it("matches same-tick local orders one-to-one without collapsing real duplicates", () => {
    const sends = [
      { seat: 7, lane: 0, sentTick: 9 },
      { seat: 7, lane: 0, sentTick: 9 },
    ];
    const result = run(sends, [pending("first", 9, 0, 200), pending("second", 9, 0, -100)]);
    expect(result).toHaveLength(2);
    expect(result.map((order) => order.sideSize)).toEqual([200, -100]);
  });

  it("filters future and landed sends and hides all lanes outside Live or Closing", () => {
    const sends = [
      { seat: 1, lane: 1, sentTick: 6 },
      { seat: 2, lane: 1, sentTick: 7 },
      { seat: 4, lane: 2, sentTick: 9 },
    ];
    expect(run(sends, []).map((item) => item.seat)).toEqual([2]);
    expect(run([...sends, { seat: 3, lane: 0, sentTick: 11 }], [])).toEqual([]);
    expect(run(sends, [], { phase: "closing" })).toHaveLength(1);
    expect(run(sends, [], { phase: "xray" })).toEqual([]);
    expect(run(sends, [], { phase: "idle" })).toEqual([]);
  });

  it("reads the valid ring window in order, including after wrapping", () => {
    const sends = empty();
    sends[63] = { seat: 3, lane: 0, sentTick: 9 };
    sends[0] = { seat: 4, lane: 1, sentTick: 9 };
    const result = run(sends, [], { tape: { sends, sendsHead: 65 } });
    expect(result.at(-2)).toMatchObject({ seat: 3, key: "send-63" });
    expect(result.at(-1)).toMatchObject({ seat: 4, key: "send-64" });
    expect(run(sends, [], { tape: { sends, sendsHead: 0 } })).toEqual([]);
  });

  it("stops at the previous round even when the ring wraps", () => {
    const sends = empty();
    sends[61] = { seat: 1, lane: 0, sentTick: 149 };
    sends[62] = { seat: 2, lane: 0, sentTick: 155 };
    sends[63] = { seat: 3, lane: 0, sentTick: 159 };
    sends[0] = { seat: 4, lane: 0, sentTick: 1 };
    sends[1] = { seat: 5, lane: 0, sentTick: 1 };
    sends[2] = { seat: 6, lane: 0, sentTick: 4 };
    sends[3] = { seat: 7, lane: 0, sentTick: 9 };
    const result = run(sends, [], { tape: { sends, sendsHead: 68 } });
    expect(result.map((order) => order.seat)).toEqual([4, 5, 6, 7]);
  });
});
