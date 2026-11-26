"use client";
import { useFloorStore } from "@/lib/floor-store";
import { requestWallet, useWalletUi } from "@/lib/wallet-ui";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Num = dynamic(() => import("./num").then((module) => module.Num), { ssr: false });

export function WalletButton({ id = "insider-wallet-button" }: { id?: string }) {
  const ready = useWalletUi((state) => state.ready);
  const active = useWalletUi((state) => state.active);
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const walletKey = useFloorStore((state) => state.walletKey);
  const player = identity === "wallet" ? walletKey : guest?.publicKey;
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const pathname = usePathname();
  const mine =
    status === "live" || status === "fixture" || status === "reconnecting"
      ? snapshot?.seats.find((seat) => player && seat.owner.equals(player))
      : undefined;
  return (
    <div className="flex items-center gap-3">
      {mine && pathname !== "/table" && (
        <span className="text-muted hidden font-mono text-[10px] tracking-wider uppercase xl:inline">
          Seat {mine.index + 1} · Chips{" "}
          <Num value={Number(mine.chips.toString())} className="text-text" />
        </span>
      )}
      {!ready && (
        <button
          type="button"
          className="wallet-adapter-button"
          disabled={active}
          onClick={() => requestWallet("select")}
        >
          {active ? "Loading wallet…" : "Select Wallet"}
        </button>
      )}
      <span id={id} />
    </div>
  );
}
