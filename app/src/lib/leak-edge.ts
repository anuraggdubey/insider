import { previewOrder, type LeakVaultAccount, type MarketAccount } from "@insider/sdk";

export function leakEdge(
  vault: LeakVaultAccount,
  tick: number,
  windowEnd: number,
  market: MarketAccount,
  feeBps: number,
) {
  const ticksLeft = Math.max(0, windowEnd - tick);
  const order =
    tick <= windowEnd
      ? vault.orders
          .slice(0, vault.orderCount)
          .filter((item) => item.sideSize !== 0 && item.landTick > tick)
          .sort((a, b) => Math.abs(b.sideSize) - Math.abs(a.sideSize))[0]
      : undefined;
  let impactBps: number | null = null;
  if (order) {
    try {
      impactBps = previewOrder(
        { base: BigInt(market.base.toString()), quote: BigInt(market.quote.toString()) },
        order.sideSize,
        { feeBps },
      ).impactBps;
    } catch {
      impactBps = null;
    }
  }
  return { ticksLeft, order, impactBps };
}
