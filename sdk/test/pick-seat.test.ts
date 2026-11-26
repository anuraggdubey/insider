import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import type { TableSnapshot } from "../src/accounts";
import { pickSeat } from "../../app/src/lib/floor-actions";

type Seat = TableSnapshot["seats"][number];

function table(tick: number, seats: Record<number, Partial<Seat>>) {
  return {
    table: { tick },
    seats: Array.from({ length: 10 }, (_, index) => ({
      index,
      owner: Keypair.generate().publicKey,
      lastSeenTick: tick,
      position: 0,
      pendingCount: 0,
      ...seats[index],
    })),
  } as unknown as TableSnapshot;
}

describe("pickSeat (mirrors claim_seat)", () => {
  it("prefers a free human seat", () => {
    const snapshot = table(50, { 8: { owner: PublicKey.default } });
    expect(pickSeat(snapshot)?.index).toBe(8);
  });

  it("takes a human seat whose holder was last seen in an earlier round", () => {
    // the tick restarts every round: a last-seen tick above the current one is from a past round
    const snapshot = table(5, { 7: { lastSeenTick: 180 } });
    expect(pickSeat(snapshot)?.index).toBe(7);
  });

  it("takes a human seat idle for 60 ticks this round, but never one with a position or orders", () => {
    expect(pickSeat(table(100, { 9: { lastSeenTick: 40 } }))?.index).toBe(9);
    expect(pickSeat(table(100, { 9: { lastSeenTick: 41 } }))).toBeNull();
    expect(pickSeat(table(100, { 9: { lastSeenTick: 40, position: 50 } }))).toBeNull();
    expect(pickSeat(table(100, { 9: { lastSeenTick: 40, pendingCount: 1 } }))).toBeNull();
  });

  it("falls back to an idle flat bot seat, but not one last seen in an earlier round", () => {
    expect(pickSeat(table(100, { 3: { lastSeenTick: 10 } }))?.index).toBe(3);
    expect(pickSeat(table(5, { 3: { lastSeenTick: 180 } }))).toBeNull();
  });

  it("never takes an AI seat", () => {
    expect(
      pickSeat(table(5, { 5: { lastSeenTick: 180 }, 6: { owner: PublicKey.default } })),
    ).toBeNull();
  });
});
