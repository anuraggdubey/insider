import { describe, expect, it } from "vitest";

import { judge, sawSomething, summary, type Probe } from "../src/privacy/rules.js";

const probe = (patch: Partial<Probe>): Probe => ({
  what: "read the vault",
  who: "observer",
  shouldSee: false,
  saw: false,
  ...patch,
});

describe("sawSomething", () => {
  it("treats null, undefined and empty lists as nothing", () => {
    expect(sawSomething(null)).toBe(false);
    expect(sawSomething(undefined)).toBe(false);
    expect(sawSomething([])).toBe(false);
    expect(sawSomething([1])).toBe(true);
    expect(sawSomething({ data: 1 })).toBe(true);
  });
});

describe("judge and summary", () => {
  it("passes hidden-when-hidden and visible-when-visible", () => {
    const results = judge([probe({}), probe({ who: "opener", shouldSee: true, saw: true })]);
    expect(results.every((r) => r.pass)).toBe(true);
    expect(summary(results)).toMatchObject({ total: 2, passed: 2, leaks: [], blind: [] });
  });

  it("reports a leak when a party learned what it should not", () => {
    const s = summary(judge([probe({ who: "anonymous", saw: true })]));
    expect(s.leaks).toEqual(["anonymous: read the vault"]);
    expect(s.blind).toEqual([]);
  });

  it("reports a blind control when the rightful reader saw nothing", () => {
    const s = summary(judge([probe({ who: "opener", shouldSee: true, saw: false })]));
    expect(s.blind).toEqual(["opener: read the vault"]);
    expect(s.leaks).toEqual([]);
  });
});
