"use client";

import { LoaderCircle, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";
import { basicButtonStyles } from "@/components/ui/button-classes";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { updateFloor, useFloorStore } from "@/lib/floor-store";
import { cancelWalletRequest, requestWallet, useWalletUi } from "@/lib/wallet-ui";

export function WalletPlayButton({
  onReady,
  size = "lg",
  compact = false,
}: {
  onReady?: () => Promise<void>;
  size?: "sm" | "lg";
  compact?: boolean;
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
      aria-label="Play with wallet"
      aria-busy={busy || undefined}
      onClick={() => {
        requestId.current = requestWallet("play", onReady);
      }}
    >
      {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {compact && <Wallet aria-hidden className="size-4 sm:hidden" />}
      <span className={compact ? "hidden sm:inline" : undefined}>Play with wallet</span>
    </button>
  );
}

export function FastModeToggle({ walletOnly = false }: { walletOnly?: boolean }) {
  const wallet = useFloorStore((state) => state.wallet);
  const identity = useFloorStore((state) => state.identity);
  const session = useFloorStore((state) => state.session);
  const status = useFloorStore((state) => state.sessionStatus);
  const error = useFloorStore((state) => state.sessionError);
  if (walletOnly && identity !== "wallet") return null;
  const busy = status === "restoring" || status === "enabling" || status === "disabling";
  const toggle = async (on: boolean) => {
    if (!wallet || identity !== "wallet" || busy) return;
    updateFloor({ sessionStatus: on ? "enabling" : "disabling", sessionError: null });
    try {
      const { disableSession, enableSession, sessionConfig } = await import("@/lib/session");
      const config = sessionConfig();
      if (on) {
        const result = await enableSession(config, wallet);
        if (
          useFloorStore.getState().walletKey?.equals(wallet.publicKey) &&
          useFloorStore.getState().identity === "wallet"
        )
          updateFloor({ session: result.session, sessionStatus: "on", sessionError: null });
      } else if (session) {
        await disableSession(config, wallet, session);
        if (useFloorStore.getState().walletKey?.equals(wallet.publicKey))
          updateFloor({ session: null, sessionStatus: "off", sessionError: null });
      }
    } catch (cause) {
      const { friendlyError } = await import("@/lib/errors");
      const text = friendlyError(cause);
      const noSol = /insufficient (funds|lamports)|insufficient balance|prior credit/i.test(text);
      const message = noSol
        ? "Your wallet needs a little devnet SOL for session account rent (refunded on revoke)."
        : text;
      if (useFloorStore.getState().walletKey?.equals(wallet.publicKey))
        updateFloor({ sessionStatus: session ? "on" : "off", sessionError: message });
      useToast.getState().add(message);
    }
  };
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <Switch
          label="Fast mode"
          checked={Boolean(session)}
          onCheckedChange={(on) => void toggle(on)}
          off="Off"
          on="On"
          disabled={!wallet || identity !== "wallet" || busy}
        />
        <div>
          <div className="text-sm font-semibold">Fast mode</div>
          <div className="text-muted text-xs">
            {busy
              ? `${status === "enabling" ? "Enabling" : status === "disabling" ? "Revoking" : "Restoring"}…`
              : session
                ? `On until ${new Date(session.validUntil * 1000).toLocaleString()}`
                : "No wallet pop-ups for 24 h"}
          </div>
        </div>
      </div>
      {!wallet && !walletOnly && <p className="text-muted text-xs">Connect a wallet to enable.</p>}
      {error && (
        <p role="status" className="text-sell text-xs">
          {error}{" "}
          {/devnet SOL/i.test(error) && (
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Get devnet SOL ↗
            </a>
          )}
        </p>
      )}
      {session && (
        <p className="text-muted text-xs">
          This device holds a session key. Anyone with it can act for your seat until it expires or
          is revoked. Private reads may still ask your wallet.
        </p>
      )}
    </div>
  );
}
