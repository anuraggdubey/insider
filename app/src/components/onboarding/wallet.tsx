"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { selectWallet, updateFloor } from "@/lib/floor-store";

export function WalletPlayButton({
  onReady,
  size = "lg",
}: {
  onReady?: () => Promise<void>;
  size?: "sm" | "lg";
}) {
  const { connected, connecting, wallet, connect, publicKey, signMessage, signTransaction } =
    useWallet();
  const { setVisible, visible } = useWalletModal();
  const router = useRouter();
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const finish = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRequested(false);
    setBusy(true);
    try {
      if (!publicKey || !signMessage || !signTransaction)
        throw new Error("This wallet must support message and transaction signing.");
      selectWallet({ publicKey, signMessage, signTransaction });
      if (onReady) await onReady();
      else {
        updateFloor({ joinRequested: true });
        router.push("/table");
      }
    } catch (error) {
      useToast.getState().add(friendlyError(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [onReady, publicKey, router, signMessage, signTransaction]);
  useEffect(() => {
    if (!requested || !connected) return;
    const timer = setTimeout(() => void finish(), 0);
    return () => clearTimeout(timer);
  }, [requested, connected, finish]);
  useEffect(() => {
    if (!requested || visible || connected || connecting) return;
    const timer = setTimeout(() => setRequested(false), 500);
    return () => clearTimeout(timer);
  }, [requested, visible, connected, connecting]);
  return (
    <Button
      variant="outline"
      size={size}
      loading={busy || connecting}
      onClick={() => {
        if (connected) void finish();
        else if (wallet) {
          setRequested(true);
          void connect().catch((error) => {
            setRequested(false);
            useToast.getState().add(friendlyError(error));
          });
        } else {
          setRequested(true);
          setVisible(true);
        }
      }}
    >
      Play with wallet
    </Button>
  );
}

export function FastModeToggle() {
  if (process.env.NEXT_PUBLIC_SESSIONS !== "1") return null;
  return (
    <Tooltip content="The program does not accept session keys yet. Each action still requires your wallet.">
      <label className="text-faint inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          disabled
          aria-label="Fast mode (session key), coming with on-chain sessions"
        />
        Fast mode (session key) — coming with on-chain sessions
      </label>
    </Tooltip>
  );
}
