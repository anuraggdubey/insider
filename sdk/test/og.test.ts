import { describe, expect, it } from "vitest";
import { parseOgParams } from "../../app/src/lib/og";

describe("share image parameters", () => {
  it("supplies generic defaults and accepts bounded share values", () => {
    expect(parseOgParams(new URLSearchParams()).success).toBe(true);
    const parsed = parseOgParams(
      new URLSearchParams({
        title: "A whale",
        line: "Read the tape",
        round: "37",
        pnl: "-42",
        kind: "Rare",
        seat: "Bold Lynx",
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toMatchObject({ round: "37", pnl: "-42", seat: "Bold Lynx" });
  });

  it("rejects excessive or malformed inputs", () => {
    for (const value of [
      { title: "x".repeat(81) },
      { line: "x".repeat(161) },
      { round: "-1" },
      { round: "4294967296" },
      { pnl: "1.5" },
      { seat: "x".repeat(33) },
      { kind: "x".repeat(33) },
    ]) {
      expect(
        parseOgParams(new URLSearchParams(Object.entries(value) as [string, string][])).success,
      ).toBe(false);
    }
  });
});
