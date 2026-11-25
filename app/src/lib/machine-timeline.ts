export const MACHINE_LOOP_MS = 9000;

export function machineFrame(time: number) {
  const tick = ((time % MACHINE_LOOP_MS) + MACHINE_LOOP_MS) % MACHINE_LOOP_MS;
  const stage =
    tick < 1400 ? 0 : tick < 3000 ? 1 : tick < 4300 ? 2 : tick < 5700 ? 3 : tick < 7000 ? 4 : 5;
  return {
    stage,
    price: stage < 3 ? "1.000" : stage < 4 ? "1.012" : "1.060",
    leakPrice: Math.max(14, 20 - Math.floor(Math.max(0, tick - 1400) / 250)),
  };
}
