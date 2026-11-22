/**
 * G1 Clock and tick rate: how many slots does the TEE advance per 500 ms crank tick, and how
 * steady is it? The measured value becomes `SLOTS_PER_TICK`; a steady clock lets us derive
 * `tick = f(clock)` with under 10% jitter.
 */
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
const ITERATIONS = 16;

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    min: sorted[0]!,
    median: sorted[Math.floor(sorted.length / 2)]!,
    max: sorted[sorted.length - 1]!,
    mean: Number(mean.toFixed(2)),
    jitter: Number((Math.sqrt(variance) / mean).toFixed(3)),
  };
};

export async function run() {
  const gate = new Gate("G1", "Clock and tick rate");
  const ctx = context(gate);
  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");

  // slot rate from polling the rollup directly
  const samples: Array<{ ms: number; slot: number }> = [];
  const started = performance.now();
  while (performance.now() - started < 6_000) {
    samples.push({ ms: performance.now() - started, slot: await session.er.getSlot() });
    await sleep(250);
  }
  const slotsPerSecond =
    (samples.at(-1)!.slot - samples[0]!.slot) / ((samples.at(-1)!.ms - samples[0]!.ms) / 1000);
  gate.note("slotsPerSecondPolled", Number(slotsPerSecond.toFixed(2)));

  await scheduleCrank(
    ctx,
    session,
    { taskId: Date.now() % 1_000_000_000, intervalMs: INTERVAL_MS, iterations: ITERATIONS },
    `probe_schedule (${ITERATIONS} x ${INTERVAL_MS} ms)`,
  );
  await sleep(ITERATIONS * INTERVAL_MS + 6_000);

  const probe = (await readProbe(session.er, session.erProgram, ctx.probe))!;
  gate.note("calls", probe.calls);
  gate.note("ticks", probe.ticks);
  const filled = Math.min(probe.logLen, probe.log.length);
  // ring buffer: oldest entry first
  const ordered = Array.from({ length: filled }, (_, i) => {
    const index = (probe.logLen - filled + i) % probe.log.length;
    return probe.log[index]!;
  });
  const slots = ordered.map((r) => r.slot.toNumber());
  const times = ordered.map((r) => r.unixTimestamp.toNumber());
  const slotDeltas = slots.slice(1).map((slot, i) => slot - slots[i]!);
  const slotStats = stats(slotDeltas);
  gate.note("tickSlots", slots);
  gate.note("tickUnixSeconds", times);
  gate.note("slotDeltaPerTick", slotStats);
  gate.note("clockGranularity", "unix_timestamp is whole seconds; derive ticks from the slot");

  await closePermission(ctx, session).catch(() => undefined);
  await undelegateProbe(ctx, session);

  if (probe.calls < ITERATIONS / 2 || slotDeltas.length < 4) {
    return gate.finish(
      "error",
      `Only ${probe.calls} crank calls arrived; the tick rate is unknown.`,
    );
  }
  const slotsPerTick = slotStats.median;
  gate.note("SLOTS_PER_TICK", slotsPerTick);
  if (slotStats.jitter >= 0.1) {
    return gate.finish(
      "info",
      `Median ${slotsPerTick} slots per ${INTERVAL_MS} ms tick but jitter is ${(slotStats.jitter * 100).toFixed(0)}%; tick is derived from the slot with catch-up of missed ticks.`,
    );
  }
  return gate.finish(
    "pass",
    `SLOTS_PER_TICK = ${slotsPerTick} (jitter ${(slotStats.jitter * 100).toFixed(1)}%). Tick is derived from the rollup slot.`,
  );
}

runIfMain(import.meta.url, run);
