"use client";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useFloorStore } from "@/lib/floor-store";
import { Num } from "./num";

export function WalletButton() {
  const guest = useFloorStore((state) => state.guest);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const mine =
    status === "live" || status === "fixture" || status === "reconnecting"
      ? snapshot?.seats.find((seat) => guest && seat.owner.equals(guest.publicKey))
      : undefined;
  return (
    <div className="flex items-center gap-3">
      {mine && (
        <span className="text-muted hidden font-mono text-[10px] tracking-wider uppercase lg:inline">
          Seat {mine.index + 1} · Chips{" "}
          <Num value={Number(mine.chips.toString())} className="text-text" />
        </span>
      )}
      <WalletMultiButton />
    </div>
  );
}
