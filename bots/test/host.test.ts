import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeKeys } from "../src/host.js";

const pack = (files: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(files)).toString("base64");

describe("writeKeys", () => {
  it("writes each key file under .keys, creating folders", () => {
    const root = mkdtempSync(join(tmpdir(), "keys-"));
    const count = writeKeys(pack({ "deployer.json": [1, 2, 3], "agents/bot.json": [4, 5] }), root);
    expect(count).toBe(2);
    expect(JSON.parse(readFileSync(join(root, ".keys/deployer.json"), "utf8"))).toEqual([1, 2, 3]);
    expect(JSON.parse(readFileSync(join(root, ".keys/agents/bot.json"), "utf8"))).toEqual([4, 5]);
  });

  it("does nothing without keys and refuses paths that escape .keys", () => {
    expect(writeKeys(undefined)).toBe(0);
    const root = mkdtempSync(join(tmpdir(), "keys-"));
    expect(() => writeKeys(pack({ "../evil.json": [1] }), root)).toThrow("bad key path");
    expect(() => writeKeys(pack({ "/abs.json": [1] }), root)).toThrow("bad key path");
  });
});
