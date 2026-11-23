/**
 * What a simulated round has to prove, judged from the X-ray the program wrote. Pure, so the rules
 * are unit-tested; `simulate-round.ts` feeds it the decoded account and prints the verdict.
 */
export type XrayOrderView = {
  seat: number;
  lane: number;
  sideSize: number;
  sentTick: number;
  landTick: number;
};

export type XrayLeakView = { state: number; readerCount: number; ownerSeat: number };

export type XrayView = {
  roundId: number;
  finalized: boolean;
  orders: XrayOrderView[];
  leaks: XrayLeakView[];
  tagCount: number;
};

export type Cast = { alice: number; bob: number; carol: number };

export type Check = { name: string; pass: boolean; detail: string };

/** Mirrors `DROPS_PER_ROUND`, `LANE_PRIORITY` and the opened state of `LeakState`. */
export const DROPS_PER_ROUND = 8;
export const LANE_PRIORITY = 1;
export const STATE_OPENED = 4;

/** A front-run: the front seat sent later than the victim but its order landed first. */
export function findFrontRun(orders: XrayOrderView[], front: number, victim: number) {
  for (const v of orders.filter((o) => o.seat === victim && o.lane !== LANE_PRIORITY)) {
    for (const f of orders.filter((o) => o.seat === front && o.lane === LANE_PRIORITY)) {
      if (f.sentTick >= v.sentTick && f.landTick < v.landTick) return { front: f, victim: v };
    }
  }
  return undefined;
}

export function evaluate(xray: XrayView, cast: Cast, round: number): Check[] {
  const opened = xray.leaks.filter((leak) => leak.state === STATE_OPENED || leak.readerCount > 0);
  const owners = new Set(xray.leaks.map((leak) => leak.ownerSeat));
  const run = findFrontRun(xray.orders, cast.alice, cast.bob);
  const landedBy = (seat: number) => xray.orders.filter((o) => o.seat === seat).length;
  return [
    {
      name: "the X-ray is the round we played and is scored",
      pass: xray.roundId === round && xray.finalized,
      detail: `round ${xray.roundId}, finalized ${xray.finalized}`,
    },
    {
      name: "all eight drops were minted",
      pass: xray.leaks.length === DROPS_PER_ROUND,
      detail: `${xray.leaks.length} leaks recorded`,
    },
    {
      name: "Alice and Carol bought Leaks",
      pass: owners.has(cast.alice) && owners.has(cast.carol),
      detail: `owners ${[...owners].join(", ")}`,
    },
    { name: "Leaks were opened", pass: opened.length >= 2, detail: `${opened.length} opened` },
    {
      name: "Bob's order landed",
      pass: landedBy(cast.bob) >= 1,
      detail: `${landedBy(cast.bob)} order(s)`,
    },
    {
      name: "Alice front-ran Bob on the priority lane",
      pass: Boolean(run),
      detail: run
        ? `Bob sent at tick ${run.victim.sentTick} and landed at ${run.victim.landTick}; Alice sent at ${run.front.sentTick} and landed at ${run.front.landTick}`
        : "no priority order of Alice's landed before one of Bob's",
    },
  ];
}
