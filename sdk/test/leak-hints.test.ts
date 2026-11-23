import { describe, expect, it } from "vitest";
import { leakHint } from "../../app/src/components/leaks/hints";

describe("relative leak hints", () => {
  it("uses current ticks and half-second units for each kind", () => {
    expect(leakHint({ kind: 0, windowStart: 16, windowEnd: 26 }, 10)).toBe("Window in 3–8 s");
    expect(leakHint({ kind: 0, windowStart: 16, windowEnd: 26 }, 20)).toBe("Window ends in 3 s");
    expect(leakHint({ kind: 4, windowStart: 34, windowEnd: 34 }, 10)).toBe("Price in 12 s");
    for (const kind of [5, 6, 7])
      expect(leakHint({ kind, windowStart: 11, windowEnd: 50 }, 10)).toBe("Next 20 s");
    for (const kind of [1, 2, 3])
      expect(leakHint({ kind, windowStart: 11, windowEnd: 20 }, 10)).toBe("Pending orders now");
    expect(leakHint({ kind: 4, windowStart: 10, windowEnd: 10 }, 11)).toBe("Expired");
  });
});
