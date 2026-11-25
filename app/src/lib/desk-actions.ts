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

async function run(config: InsiderConfig, instruction: Parameters<typeof tx>[number]) {
  const player = deskPlayer();
  if (!player) throw new Error("Play on the floor first: connect a wallet or take a seat.");
  const connection = await teeConnection(config, player);
  if (player instanceof Keypair) await sendTx(connection, tx(instruction), [player]);
  else await sendWithWallet(connection, tx(instruction), player);
}

function key(): PublicKey {
  const player = deskPlayer();
  if (!player) throw new Error("Play on the floor first: connect a wallet or take a seat.");
  return player.publicKey;
}

export const mintDeskCall = (
  config: InsiderConfig,
  seat: number,
  call: { direction: 1 | -1; horizon: number; stake: number; licenseAsk: number },
) => run(config, mintCall(config, key(), seat, { ...call, confidence: 50 }));

export const buyDeskLicense = (config: InsiderConfig, seat: number, authorSeat: number) =>
  run(config, buyCallLicense(config, key(), seat, authorSeat));

export const tradeDesk = (config: InsiderConfig, seat: number, size: number) =>
  run(config, deskTrade(config, key(), seat, size));
