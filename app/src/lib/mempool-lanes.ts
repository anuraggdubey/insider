import type { TapeAccount, TableView } from "@insider/sdk";

export type LaneOrder = {
  key: string;
  seat: number;
  lane: number;
  sentTick: number;
  landTick: number;
  sideSize?: number;
  mine: boolean;
};

const ORDER_WIDTH = 104;

export function stackLaneOrders(orders: LaneOrder[], tick: number, delay: number, width: number) {
  const rows: number[] = [];
  const distance = Math.max(0, width - ORDER_WIDTH);
  return [...orders]
    .sort((a, b) => a.sentTick - b.sentTick || a.key.localeCompare(b.key))
    .map((order) => {
      const x = Math.max(0, Math.min(1, (tick - order.sentTick) / delay)) * distance;
      let row = rows.findIndex((last) => Math.abs(last - x) >= ORDER_WIDTH);
      if (row === -1) row = rows.length;
      rows[row] = x;
      return { order, row };
    });
}

type Pending = TableView["myPending"][number];

export function currentRoundSends(tape: Pick<TapeAccount, "sends" | "sendsHead">, tick: number) {
  const count = Math.min(tape.sendsHead, tape.sends.length);
  const events: { sequence: number; event: TapeAccount["sends"][number] }[] = [];
  let newerTick = tick;
  for (let sequence = tape.sendsHead - 1; sequence >= tape.sendsHead - count; sequence--) {
    const event = tape.sends[sequence % tape.sends.length];
    if (!event) continue;
    if (event.sentTick > newerTick) break;
    newerTick = event.sentTick;
    events.push({ sequence, event });
  }
  return events.reverse();
}

export function mempoolLanes({
  tape,
  tick,
  phase,
  standardDelay,
  priorityDelay,
  mySeat,
  pending,
}: {
  tape: Pick<TapeAccount, "sends" | "sendsHead">;
  tick: number;
  phase: string;
  standardDelay: number;
  priorityDelay: number;
  mySeat?: number;
  pending: Pending[];
}): LaneOrder[] {
  if (phase !== "live" && phase !== "closing") return [];
  const matched = new Set<string>();
  const orders: LaneOrder[] = [];
  for (const { sequence, event } of currentRoundSends(tape, tick)) {
    if (event.seat >= 10 || (event.lane !== 0 && event.lane !== 1)) continue;
    const delay = event.lane === 1 ? priorityDelay : standardDelay;
    const landTick = event.sentTick + delay;
    if (delay <= 0 || event.sentTick > tick || landTick <= tick) continue;
    const own =
      event.seat === mySeat
        ? pending.find(
            (item) =>
              !matched.has(item.id) && item.lane === event.lane && item.sentTick === event.sentTick,
          )
        : undefined;
    if (own) matched.add(own.id);
    orders.push({
      key: `send-${sequence}`,
      seat: event.seat,
      lane: event.lane,
      sentTick: event.sentTick,
      landTick,
      mine: event.seat === mySeat,
      ...(own ? { sideSize: own.sideSize } : {}),
    });
  }
  if (mySeat !== undefined) {
    for (const order of pending) {
      if (matched.has(order.id) || order.sentTick > tick || order.landTick <= tick) continue;
      orders.push({
        key: `local-${order.id}`,
        seat: mySeat,
        lane: order.lane,
        sentTick: order.sentTick,
        landTick: order.landTick,
        sideSize: order.sideSize,
        mine: true,
      });
    }
  }
  return orders;
}
