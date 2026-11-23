import type { LeakVaultAccount, TableView } from "@insider/sdk";
import { seatName } from "@insider/sdk/names";

const price = (value: number) => (value / 1_000_000).toFixed(4);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

export function payloadLines(vault: LeakVaultAccount, view: TableView): string[] {
  const fields = vault.fields;
  const name = (index: number) =>
    view.seats.find((seat) => seat.index === index)?.name ?? seatName(index);
  const orderText = (order: LeakVaultAccount["orders"][number]) =>
    `${name(order.seat)} · ${order.sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(order.sideSize)} · T+${order.landTick}`;
  const orders = vault.orders
    .slice(0, vault.orderCount)
    .filter((order) => order.sideSize !== 0)
    .sort((a, b) => a.landTick - b.landTick || a.seq - b.seq);
  switch (vault.kind) {
    case 0:
      return [
        `Net ${signed(fields[0]!)} units · ${fields[1]} orders`,
        `Window T+${fields[2]}–${fields[3]}`,
      ];
    case 1:
      return orders[0]
        ? [
            orderText(orders[0]),
            `Lands in ${Math.max(0, (orders[0].landTick - view.tick) / 2).toFixed(1)}s`,
          ]
        : ["No pending order was captured."];
    case 2:
      return orders[0]
        ? [
            `Whale · ${orders[0].sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(orders[0].sideSize)}`,
            `Lands in ${Math.max(0, (orders[0].landTick - view.tick) / 2).toFixed(1)}s`,
          ]
        : ["No whale in 30 seconds."];
    case 3:
      return orders.length ? orders.map(orderText) : ["No pending orders at mint."];
    case 4:
      return [`Target ${price(fields[1]!)} at T+${fields[0]}`];
    case 5:
      return [
        `${fields[2]! > 0 ? "Up" : fields[2]! < 0 ? "Down" : "Flat"} · ${["<1%", "1–3%", ">3%"][fields[3]!] ?? "—"}`,
        `${signed(fields[4]!)} bps · T+${fields[0]}–${fields[1]}`,
      ];
    case 6:
      return fields[0]
        ? [`Shock at T+${fields[1]} · ${fields[2]! > 0 ? "positive" : "negative"}`]
        : ["No shock in this window."];
    case 7:
      return [
        `High ${price(fields[0]!)} at T+${fields[1]}`,
        `Low ${price(fields[2]!)} at T+${fields[3]}`,
      ];
    default:
      return ["Unknown payload type."];
  }
}
