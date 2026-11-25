"use client";

import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { selectWallet, syncWallet, updateFloor } from "@/lib/floor-store";
import { useWalletUi } from "@/lib/wallet-ui";

function WalletBridge() {
  const { connected, connecting, wallet, connect, publicKey, signMessage, signTransaction } =
    useWallet();
  const { setVisible, visible } = useWalletModal();
  const request = useWalletUi((state) => state.request);
  const router = useRouter();
  const handled = useRef(0);
  const running = useRef(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () =>
      setTarget(
        document.getElementById("insider-wallet-button-mobile") ??
          document.getElementById("insider-wallet-button"),
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const key = connected ? publicKey : null;
    syncWallet(
      key,
      key && signMessage && signTransaction
        ? { publicKey: key, signMessage, signTransaction }
        : null,
    );
  }, [connected, publicKey, signMessage, signTransaction]);
  useEffect(() => {
    useWalletUi.setState({ connecting });
  }, [connecting]);
  useEffect(() => {
    useWalletUi.setState({ ready: true });
    return () => useWalletUi.setState({ ready: false });
  }, []);
  const finish = useCallback(async () => {
    const pending = useWalletUi.getState().request;
    if (running.current || !pending || pending.action !== "play") return;
    running.current = true;
    useWalletUi.setState({ request: null, busy: true });
    try {
      if (!publicKey || !signMessage || !signTransaction)
        throw new Error("This wallet must support message and transaction signing.");
      selectWallet({ publicKey, signMessage, signTransaction });
      if (pending.onReady) await pending.onReady();
      else {
        updateFloor({ joinRequested: true });
        router.push("/table");
      }
    } catch (error) {
      useToast.getState().add(friendlyError(error));
    } finally {
      running.current = false;
      useWalletUi.setState({ busy: false });
    }
  }, [publicKey, router, signMessage, signTransaction]);
  useEffect(() => {
    if (!request || request.id === handled.current) return;
    handled.current = request.id;
    if (request.action === "select") {
      useWalletUi.setState({ request: null });
      setVisible(true);
    } else if (connected) {
      void finish();
    } else if (wallet) {
      void connect().catch((error) => {
        useWalletUi.setState({ request: null });
        useToast.getState().add(friendlyError(error));
      });
    } else {
      setVisible(true);
    }
  }, [request, connected, wallet, connect, finish, setVisible]);
  useEffect(() => {
    if (request?.action === "play" && connected) void finish();
  }, [request, connected, finish]);
  useEffect(() => {
    if (request?.action !== "play" || visible || connected || connecting) return;
    const timer = setTimeout(() => {
      if (useWalletUi.getState().request?.id === request.id)
        useWalletUi.setState({ request: null });
    }, 500);
    return () => clearTimeout(timer);
  }, [request, visible, connected, connecting]);
  return target ? createPortal(<WalletMultiButton />, target) : null;
}

export function WalletRuntime() {
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider
      endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletBridge />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
