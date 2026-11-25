import { expect, it } from "vitest";
import { machineFrame } from "../../app/src/lib/machine-timeline";

it("shows the order, falling auction, reveal, priority, fill and payoff in a nine-second loop", () => {
  expect(machineFrame(0)).toMatchObject({ stage: 0, price: "1.000", leakPrice: 20 });
  expect(machineFrame(1400)).toMatchObject({ stage: 1, leakPrice: 20 });
  expect(machineFrame(2900)).toMatchObject({ stage: 1, leakPrice: 14 });
  expect(machineFrame(3000)).toMatchObject({ stage: 2, price: "1.000" });
  expect(machineFrame(4300)).toMatchObject({ stage: 3, price: "1.012" });
  expect(machineFrame(5700)).toMatchObject({ stage: 4, price: "1.060" });
  expect(machineFrame(7000)).toMatchObject({ stage: 5, price: "1.060" });
  expect(machineFrame(9000)).toEqual(machineFrame(0));
});
