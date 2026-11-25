"use client";

import {
  buyCallLicense,
  deskTrade,
  mintCall,
  sendTx,
  sendWithWallet,
  teeConnection,
  tx,
  type InsiderConfig,
} from "@insider/sdk";
import { Keypair, type PublicKey } from "@solana/web3.js";
import { loadGuest } from "./guest";
import { useFloorStore, type WalletSigner } from "./floor-store";
import { currentActionActor, sessionActionError, type SessionAction } from "./session-routing";

type Player = Keypair | WalletSigner;

/** The identity the floor uses: the connected wallet, or this browser's guest key. */
export function deskPlayer(): Player | null {
  const state = useFloorStore.getState();
  if (state.identity === "wallet") {
    return state.wallet && state.walletKey?.equals(state.wallet.publicKey) ? state.wallet : null;
  }
  return state.guest ?? loadGuest();
}

export function deskPlayerKey(): PublicKey | null {
  if (typeof window === "undefined") return null;
  return deskPlayer()?.publicKey ?? null;
}

async function run(
  config: InsiderConfig,
  action: SessionAction,
  build: (owner: PublicKey, token?: PublicKey) => Parameters<typeof tx>[number],
) {
  const player = deskPlayer();
  if (!player) throw new Error("Play on the floor first: connect a wallet or take a seat.");
  const actor = currentActionActor(action, player);
  try {
    const connection = await teeConnection(config, actor.signer);
    const instruction = build(actor.signer.publicKey, actor.token);
    if (actor.signer instanceof Keypair) await sendTx(connection, tx(instruction), [actor.signer]);
    else await sendWithWallet(connection, tx(instruction), actor.signer);
  } catch (error) {
    throw sessionActionError(error, actor);
  }
}

export const mintDeskCall = (
  config: InsiderConfig,
  seat: number,
  call: { direction: 1 | -1; horizon: number; stake: number; licenseAsk: number },
) =>
  run(config, "mintCall", (owner, token) =>
    mintCall(config, owner, seat, { ...call, confidence: 50 }, token),
  );

export const buyDeskLicense = (config: InsiderConfig, seat: number, authorSeat: number) =>
  run(config, "buyCallLicense", (owner, token) =>
    buyCallLicense(config, owner, seat, authorSeat, token),
  );

export const tradeDesk = (config: InsiderConfig, seat: number, size: number) =>
  run(config, "deskTrade", (owner, token) => deskTrade(config, owner, seat, size, token));
