import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("workspace setup", () => {
  it("keeps the program id in sync between Anchor.toml and lib.rs", () => {
    const anchorToml = read("programs/Anchor.toml");
    const libRs = read("programs/insider/src/lib.rs");
    const fromToml = anchorToml.match(/insider = "([1-9A-HJ-NP-Za-km-z]{32,44})"/)?.[1];
    const fromRs = libRs.match(/declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\)/)?.[1];
    expect(fromToml).toBeDefined();
    expect(fromToml).toBe(fromRs);
  });
});
