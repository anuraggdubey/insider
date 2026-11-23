import { TICK_MILLIS } from "@insider/sdk";

export function leakHint(
  leak: { kind: number; windowStart: number; windowEnd: number },
  tick: number,
) {
  if (tick > leak.windowEnd) return "Expired";
  const seconds = (target: number) => (Math.max(0, target - tick) * TICK_MILLIS) / 1000;
  if (leak.kind === 0) {
    if (tick >= leak.windowStart) return `Window ends in ${seconds(leak.windowEnd)} s`;
    return `Window in ${seconds(leak.windowStart)}–${seconds(leak.windowEnd)} s`;
  }
  if (leak.kind === 4) return `Price in ${seconds(leak.windowEnd)} s`;
  if (leak.kind >= 5 && leak.kind <= 7) return `Next ${seconds(leak.windowEnd)} s`;
  return "Pending orders now";
}
