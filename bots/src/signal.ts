/**
 * Turns an opened Leak's payload into a trade signal. Pure. `kind` follows `LeakKind`:
 * 0 Flow, 1 Spotlight, 2 Whale, 3 Full Book, 4 Pin, 5 Drift, 6 Shockwave, 7 Summit.
 * Payload layout: `programs/insider/src/state/leak_vault.rs`.
 */
export type Payload = {
  kind: number;
  fields: number[];
  orders: Array<{ sideSize: number; landTick: number }>;
  orderCount: number;
};

export type Signal = { side: 1 | -1; strength: number; why: string };

const sign = (n: number): 1 | -1 | 0 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** `price` is the market price as a plain number (1.0 = start). */
export function payloadSignal(payload: Payload, price: number): Signal | undefined {
  const { kind, fields, orders, orderCount } = payload;
  switch (kind) {
    case 0: {
      // Flow: net units over a window; the crowd is about to push that way
      const side = sign(fields[0] ?? 0);
      return side
        ? { side, strength: Math.min(1, Math.abs(fields[0]!) / 1_000), why: "flow" }
        : undefined;
    }
    case 1:
    case 2: {
      // Spotlight / Whale: one order, in `orders[0]`
      const order = orders[0];
      const side = order && orderCount > 0 ? sign(order.sideSize) : 0;
      return side && order
        ? {
            side,
            strength: Math.min(1, Math.abs(order.sideSize) / 1_000),
            why: kind === 2 ? "whale" : "spotlight",
          }
        : undefined;
    }
    case 3: {
      // Full Book: every pending order; trade the net
      const net = orders.slice(0, orderCount).reduce((sum, order) => sum + order.sideSize, 0);
      const side = sign(net);
      return side ? { side, strength: Math.min(1, Math.abs(net) / 1_500), why: "book" } : undefined;
    }
    case 4: {
      // Pin: the fundamental at a target tick (1e6); the market is pulled toward it
      const target = (fields[1] ?? 0) / 1_000_000;
      const side = sign(target - price);
      const gap = Math.abs(target - price) / Math.max(price, 0.0001);
      return side ? { side, strength: Math.min(1, gap * 10), why: "pin" } : undefined;
    }
    case 5: {
      const side = sign(fields[2] ?? 0);
      return side
        ? { side, strength: Math.min(1, Math.abs(fields[4] ?? 0) / 500), why: "drift" }
        : undefined;
    }
    case 6: {
      // Shockwave: [has shock, shock tick, sign, window end]
      return fields[0] === 1 && fields[2] !== 0
        ? { side: sign(fields[2]!) as 1 | -1, strength: 1, why: "shock" }
        : undefined;
    }
    default:
      return undefined;
  }
}
