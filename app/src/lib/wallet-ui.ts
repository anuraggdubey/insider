"use client";

import { create } from "zustand";

export type WalletRequest = {
  id: number;
  action: "select" | "play";
  onReady?: () => Promise<void>;
};
type WalletUiState = {
  active: boolean;
  ready: boolean;
  busy: boolean;
  connecting: boolean;
  request: WalletRequest | null;
};
export const useWalletUi = create<WalletUiState>(() => ({
  active: false,
  ready: false,
  busy: false,
  connecting: false,
  request: null,
}));
let nextRequest = 0;

export function activateWallet() {
  useWalletUi.setState({ active: true });
}

export function requestWallet(action: WalletRequest["action"], onReady?: () => Promise<void>) {
  const id = ++nextRequest;
  useWalletUi.setState({
    active: true,
    request: { id, action, onReady },
  });
  return id;
}

export function cancelWalletRequest(id: number) {
  if (useWalletUi.getState().request?.id === id) useWalletUi.setState({ request: null });
}
