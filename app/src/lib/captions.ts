import { WHALE_SEAT, type TableSnapshot, type TableView } from "@insider/sdk";

export type CameraEvent =
  | {
      kind: "fill";
      tick: number;
      name: string;
      seat: number;
      size: number;
      side: number;
      price: number;
    }
  | { kind: "open"; tick: number; name: string; leak: string }
  | { kind: "priority"; tick: number; name: string; count: number; fee: number }
  | { kind: "sandwich"; tick: number; name: string; victim: string; profit: number };

export function caption(event: CameraEvent): string {
  switch (event.kind) {
    case "fill":
      return event.seat === WHALE_SEAT
        ? `A whale ${event.side > 0 ? "bought" : "sold"} ${event.size.toLocaleString()} units. The pool noticed.`
        : `${event.name} ${event.side > 0 ? "bought" : "sold"} ${event.size.toLocaleString()} units at ${(event.price / 1_000_000).toFixed(4)}.`;
    case "open":
      return `${event.name} opened a ${event.leak} Leak.`;
    case "priority":
      return `${event.name} just paid ${event.fee} chips to jump the line.`;
    case "sandwich":
      return `${event.name} caught ${event.victim} in the middle for ${event.profit > 0 ? "+" : ""}${event.profit} chips.`;
  }
}

export function cameraEvent(view: TableView, snapshot: TableSnapshot): CameraEvent | null {
  const now = view.tick;
  const name = (seat: number) =>
    seat === WHALE_SEAT
      ? "Whale"
      : (view.seats.find((item) => item.index === seat)?.name ?? `Seat ${seat + 1}`);
  const events: { event: CameraEvent; weight: number }[] = [];
  for (const event of view.feed) {
    if (event.tick > now || event.tick < now - 12) continue;
    if (event.type === "fill")
      events.push({
        event: {
          kind: "fill",
          tick: event.tick,
          name: name(event.seat),
          seat: event.seat,
          size: event.size,
          side: event.side,
          price: event.price,
        },
        weight: event.size + (event.seat === WHALE_SEAT ? 2_000 : 0),
      });
  }
  for (const leak of view.leaks) {
    if (leak.openedTick > 0 && leak.openedTick <= now && leak.openedTick >= now - 12)
      events.push({
        event: {
          kind: "open",
          tick: leak.openedTick,
          name: name(leak.ownerSeat),
          leak: leak.kindName,
        },
        weight: 1_500,
      });
  }
  const priority = view.feed.filter(
    (event) =>
      event.type === "send" && event.lane === 1 && event.tick <= now && event.tick >= now - 6,
  );
  if (priority.length >= 3) {
    const latest = priority[0]!;
    events.push({
      event: {
        kind: "priority",
        tick: latest.tick,
        name: name(latest.seat),
        count: priority.length,
        fee: snapshot.table.params.priorityFee,
      },
      weight: 1_800 + priority.length * 50,
    });
  }
  if (snapshot.xray?.finalized && view.phase === "xray") {
    for (const tag of snapshot.xray.tags.slice(0, snapshot.xray.tagCount))
      events.push({
        event: {
          kind: "sandwich",
          tick: 180,
          name: name(tag.front),
          victim: name(tag.victim),
          profit: tag.profitEstimate,
        },
        weight: 10_000 + Math.abs(tag.profitEstimate),
      });
  }
  return (
    events.sort((a, b) => b.weight - a.weight || b.event.tick - a.event.tick)[0]?.event ?? null
  );
}
