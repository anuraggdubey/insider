"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSyncExternalStore } from "react";
import { useFloorStore } from "@/lib/floor-store";
import { Num } from "./num";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function WalletButton() {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const walletKey = useFloorStore((state) => state.walletKey);
  const player = identity === "wallet" ? walletKey : guest?.publicKey;
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const mine =
    status === "live" || status === "fixture" || status === "reconnecting"
      ? snapshot?.seats.find((seat) => player && seat.owner.equals(player))
      : undefined;
  return (
    <div className="flex items-center gap-3">
      {mine && (
        <span className="text-muted hidden font-mono text-[10px] tracking-wider uppercase lg:inline">
          Seat {mine.index + 1} · Chips{" "}
          <Num value={Number(mine.chips.toString())} className="text-text" />
        </span>
      )}
      {mounted ? (
        <WalletMultiButton />
      ) : (
        <span
          aria-hidden
          className="border-line-strong text-muted rounded border px-4 py-3 font-mono text-[10px]"
        >
          Select Wallet
        </span>
      )}
    </div>
  );
}
