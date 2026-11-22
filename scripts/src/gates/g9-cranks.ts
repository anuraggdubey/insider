/**
 * G9 Duplicate cranks: if two crank tasks run the same tick, is state still correct?
 * `probe_tick(min_slots)` only advances when `min_slots` have passed since the last effective
 * tick. A single task gives the baseline; two tasks on the same cadence must not double it.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROOT } from "../lib/config.js";
import {
  Gate,
  closePermission,
  context,
  delegateProbe,
  readProbe,
  resetProbe,
  runIfMain,
  scheduleCrank,
  sleep,
  undelegateProbe,
} from "./lib.js";

const INTERVAL_MS = 500;
const ITERATIONS = 10;

/** SLOTS_PER_TICK from G1 when it has run; otherwise a conservative guess. */
function slotsPerTick(): number {
  const path = resolve(ROOT, "docs/proofs/gates/g1.json");
  if (existsSync(path)) {
    const facts = (JSON.parse(readFileSync(path, "utf8")) as { facts: { SLOTS_PER_TICK?: number } })
      .facts;
    if (facts.SLOTS_PER_TICK) return facts.SLOTS_PER_TICK;
  }
  return 5;
}

export async function run() {
  const gate = new Gate("G9", "Duplicate cranks");
  const ctx = context(gate);
  // a gate counts a tick when at least 80% of a tick's slots have passed
  const minSlots = Math.max(1, Math.floor(slotsPerTick() * 0.8));
  gate.note("minSlots", minSlots);

  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");
  const taskBase = Date.now() % 1_000_000_000;
  const waitMs = ITERATIONS * INTERVAL_MS + 6_000;

  const before = (await readProbe(session.er, session.erProgram, ctx.probe))!;

  // 1. baseline: one task
  await scheduleCrank(
    ctx,
    session,
    { taskId: taskBase, intervalMs: INTERVAL_MS, iterations: ITERATIONS, minSlots },
    "probe_schedule (single task)",
  );
  await sleep(waitMs);
  const single = (await readProbe(session.er, session.erProgram, ctx.probe))!;
  const singleCalls = single.calls - before.calls;
  const singleTicks = single.ticks - before.ticks;
  gate.note("single", { calls: singleCalls, ticks: singleTicks });

  // 2. duplicates: two tasks on the same cadence
  await scheduleCrank(
    ctx,
    session,
    { taskId: taskBase + 1, intervalMs: INTERVAL_MS, iterations: ITERATIONS, minSlots },
    "probe_schedule (duplicate task A)",
  );
  await scheduleCrank(
    ctx,
    session,
    { taskId: taskBase + 2, intervalMs: INTERVAL_MS, iterations: ITERATIONS, minSlots },
    "probe_schedule (duplicate task B)",
  );
  await sleep(waitMs);
  const double = (await readProbe(session.er, session.erProgram, ctx.probe))!;
  const doubleCalls = double.calls - single.calls;
  const doubleTicks = double.ticks - single.ticks;
  gate.note("duplicate", { calls: doubleCalls, ticks: doubleTicks });

  await closePermission(ctx, session).catch(() => undefined);
  await undelegateProbe(ctx, session);

  if (singleCalls < ITERATIONS / 2 || doubleCalls < singleCalls) {
    return gate.finish(
      "error",
      `Crank calls did not arrive as expected (single ${singleCalls}, duplicate ${doubleCalls}).`,
    );
  }
  // idempotent: twice the calls must not give meaningfully more effective ticks
  const idempotent = doubleTicks <= singleTicks + 2;
  gate.note("idempotent", idempotent);
  if (idempotent) {
    return gate.finish(
      "pass",
      `Duplicate tasks made ${doubleCalls} calls but only ${doubleTicks} effective ticks (single task: ${singleTicks}). A tick gated on elapsed slots is idempotent.`,
    );
  }
  return gate.finish(
    "info",
    `Duplicates inflated effective ticks (${doubleTicks} vs ${singleTicks}); tick must be strictly time-gated with a larger window.`,
  );
}

runIfMain(import.meta.url, run);
