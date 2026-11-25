"use client";

import {
  type Keypair,
  type PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { type LeakVaultAccount, type LocalOrder, type TableSnapshot } from "@insider/sdk";
import { create } from "zustand";
import { type Fixture } from "./fixture";

type FloorState = {
  status: "loading" | "live" | "reconnecting" | "offline" | "fixture";
  snapshot: TableSnapshot | null;
  guest: Keypair | null;
  identity: "guest" | "wallet";
  walletKey: PublicKey | null;
  wallet: WalletSigner | null;
  session: FastSession | null;
  sessionStatus: "off" | "restoring" | "enabling" | "on" | "disabling" | "expired";
  sessionError: string | null;
  joinRequested: boolean;
  fixture: Fixture | null;
  pending: LocalOrder[];
  vaults: Record<number, LeakVaultAccount>;
  tutorial: boolean;
  error: string | null;
  orderDraft: { side: "buy" | "sell"; size: number; id: number } | null;
};

export type FastSession = {
  wallet: PublicKey;
  signer: Keypair;
  token: PublicKey;
  validUntil: number;
};

export type WalletSigner = {
  publicKey: PublicKey;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signVersionedTransaction?(transaction: VersionedTransaction): Promise<VersionedTransaction>;
};

export const useFloorStore = create<FloorState>(() => ({
  status: "loading",
  snapshot: null,
  guest: null,
  identity: "guest",
  walletKey: null,
  wallet: null,
  session: null,
  sessionStatus: "off",
  sessionError: null,
  joinRequested: false,
  fixture: null,
  pending: [],
  vaults: {},
  tutorial: false,
  error: null,
  orderDraft: null,
}));

export function updateFloor(update: Partial<FloorState>) {
  useFloorStore.setState(update);
}

export function publishFixture(fixture: Fixture) {
  updateFloor({ fixture, snapshot: { ...fixture.snapshot }, status: "fixture" });
}

export function playerKey(state: FloorState): PublicKey | null {
  return state.identity === "wallet" ? state.walletKey : (state.guest?.publicKey ?? null);
}

function rememberIdentity(identity: FloorState["identity"]) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem("insider.identity.v1", identity);
  } catch {}
}

export function restoreIdentity() {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem("insider.identity.v1") === "wallet"
    )
      updateFloor({ identity: "wallet", pending: [], vaults: {} });
  } catch {}
}

export function selectGuest(guest: Keypair) {
  const previous = playerKey(useFloorStore.getState());
  updateFloor({
    identity: "guest",
    session: null,
    sessionStatus: "off",
    sessionError: null,
    guest,
    joinRequested: false,
    ...(previous?.equals(guest.publicKey) ? {} : { pending: [], vaults: {} }),
  });
  rememberIdentity("guest");
}

export function syncWallet(key: PublicKey | null, signer: WalletSigner | null) {
  const state = useFloorStore.getState();
  const changed = state.walletKey?.toBase58() !== key?.toBase58();
  updateFloor({
    walletKey: key,
    wallet: signer,
    ...(changed ? { session: null, sessionStatus: "off" as const, sessionError: null } : {}),
    ...(changed && state.identity === "wallet" ? { pending: [], vaults: {} } : {}),
  });
}

export function selectWallet(signer: WalletSigner) {
  const previous = playerKey(useFloorStore.getState());
  updateFloor({
    identity: "wallet",
    walletKey: signer.publicKey,
    wallet: signer,
    ...(previous?.equals(signer.publicKey)
      ? {}
      : { session: null, sessionStatus: "off" as const, sessionError: null }),
    ...(previous?.equals(signer.publicKey) ? {} : { pending: [], vaults: {} }),
  });
  rememberIdentity("wallet");
}
