"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { basicButtonStyles } from "@/components/ui/button-classes";
import { Tooltip } from "@/components/ui/tooltip";
import { cancelWalletRequest, requestWallet, useWalletUi } from "@/lib/wallet-ui";

export function WalletPlayButton({
  onReady,
  size = "lg",
}: {
  onReady?: () => Promise<void>;
  size?: "sm" | "lg";
}) {
  const busy = useWalletUi(
    (state) => state.busy || state.connecting || state.request?.action === "play",
  );
  const requestId = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (requestId.current !== null) cancelWalletRequest(requestId.current);
    },
    [],
  );
  return (
    <button
      type="button"
      className={basicButtonStyles("outline", size)}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() => {
        requestId.current = requestWallet("play", onReady);
      }}
    >
      {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      Play with wallet
    </button>
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
