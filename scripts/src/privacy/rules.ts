/**
 * Privacy test rules (A-2.3). A probe is one party trying to learn one thing; the rule says
 * whether it should succeed. Pure, so it is unit-tested; `privacy-test.ts` runs the probes live.
 */
export type Party = "opener" | "observer" | "authority" | "anonymous";

export type Probe = {
  /** What was tried, e.g. "read the sealed vault". */
  what: string;
  who: Party;
  /** True when this party is supposed to learn it (a control or the rightful reader). */
  shouldSee: boolean;
  /** True when the attempt returned data, signatures, logs or an account. */
  saw: boolean;
  detail?: string;
};

export type Result = Probe & { pass: boolean };

/** Anything that is not data counts as "saw nothing": null, an empty list or an error. */
export const sawSomething = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const judge = (probes: Probe[]): Result[] =>
  probes.map((probe) => ({ ...probe, pass: probe.saw === probe.shouldSee }));

export const summary = (results: Result[]) => {
  const leaks = results.filter((r) => !r.pass && !r.shouldSee);
  const blind = results.filter((r) => !r.pass && r.shouldSee);
  return {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    /** A party learned something it should not have. */
    leaks: leaks.map((r) => `${r.who}: ${r.what}`),
    /** A control failed: the probe itself is not trustworthy. */
    blind: blind.map((r) => `${r.who}: ${r.what}`),
  };
};
