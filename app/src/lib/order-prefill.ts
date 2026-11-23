import type { TableSnapshot, TableView } from "@insider/sdk";

export type FillEvent = Extract<TableView["feed"][number], { type: "fill" }>;

export function draftForFill(
  fill: FillEvent | null | undefined,
  view: TableView,
  params: TableSnapshot["table"]["params"],
  fade: boolean,
): { side: "buy" | "sell"; size: number } | null {
  if (!fill || !view.mine || view.mine.liquidated || view.phase !== "live") return null;
  const direction = fill.side * (fade ? -1 : 1);
  if (!direction) return null;
  const projected =
    view.mine.position + view.myPending.reduce((sum, order) => sum + order.sideSize, 0);
  const room =
    direction > 0 ? params.maxPositionUnits - projected : params.maxPositionUnits + projected;
  const size = Math.floor(Math.max(0, Math.min(fill.size, params.maxOrderUnits, room)) / 50) * 50;
  return size > 0 ? { side: direction > 0 ? "buy" : "sell", size } : null;
}
