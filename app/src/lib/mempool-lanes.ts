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

type Pending = TableView["myPending"][number];

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
  const count = Math.min(tape.sendsHead, tape.sends.length);
  const first = tape.sendsHead - count;
  for (let sequence = first; sequence < tape.sendsHead; sequence++) {
    const event = tape.sends[sequence % tape.sends.length];
    if (!event || event.seat >= 10 || (event.lane !== 0 && event.lane !== 1)) continue;
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
