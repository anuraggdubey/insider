"use client";

import { type Keypair } from "@solana/web3.js";
import { type LeakVaultAccount, type LocalOrder, type TableSnapshot } from "@insider/sdk";
import { create } from "zustand";
import { type Fixture } from "./fixture";

type FloorState = {
  status: "loading" | "live" | "reconnecting" | "offline" | "fixture";
  snapshot: TableSnapshot | null;
  guest: Keypair | null;
  fixture: Fixture | null;
  pending: LocalOrder[];
  vaults: Record<number, LeakVaultAccount>;
  tutorial: boolean;
  error: string | null;
};
export const useFloorStore = create<FloorState>(() => ({
  status: "loading",
  snapshot: null,
  guest: null,
  fixture: null,
  pending: [],
  vaults: {},
  tutorial: false,
  error: null,
}));

export function updateFloor(update: Partial<FloorState>) {
  useFloorStore.setState(update);
}

export function publishFixture(fixture: Fixture) {
  updateFloor({ fixture, snapshot: { ...fixture.snapshot }, status: "fixture" });
}
