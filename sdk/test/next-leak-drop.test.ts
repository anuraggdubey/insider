import { describe, expect, it } from "vitest";
import type { TableSnapshot } from "../src/accounts";
import { nextLeakDrop } from "../../app/src/lib/next-leak-drop";

type Board = Parameters<typeof nextLeakDrop>[0];
function board(): Board {
  return {
    roundId: 1,
    dropIndex: 0,
    headers: Array.from({ length: 6 }, () => ({
      state: 0,
      readerCount: 0,
      windowEnd: 0,
    })) as TableSnapshot["board"]["headers"],
  };
}

describe("next leak drop", () => {
  it("shows the next scheduled drop in the first available slot", () => {
    const value = board();
    expect(nextLeakDrop(value, 1, 0, "live")).toEqual({ slot: 0, time: "0:05" });
    value.dropIndex = 1;
    value.headers[0]!.state = 1;
    expect(nextLeakDrop(value, 1, 10, "live")).toEqual({ slot: 1, time: "0:10" });
  });

  it("does not promise a drop at capacity, with stale data, or after the schedule", () => {
    const value = board();
    expect(nextLeakDrop(value, 2, 0, "live")).toBeNull();
    expect(nextLeakDrop(value, 1, 10, "live")).toBeNull();
    expect(nextLeakDrop(value, 1, 0, "closing")).toBeNull();
    value.headers.slice(0, 4).forEach((header) => (header.state = 2));
    expect(nextLeakDrop(value, 1, 0, "live")).toBeNull();
    value.dropIndex = 8;
    expect(nextLeakDrop(value, 1, 0, "live")).toBeNull();
  });

  it("accounts for an expired reusable slot ahead of an empty one", () => {
    const value = board();
    value.headers[0]!.state = 5;
    value.headers[0]!.windowEnd = 9;
    expect(nextLeakDrop(value, 1, 0, "live")).toEqual({ slot: 0, time: "0:05" });
    value.headers[0]!.readerCount = 1;
    expect(nextLeakDrop(value, 1, 0, "live")).toEqual({ slot: 1, time: "0:05" });
  });
});
