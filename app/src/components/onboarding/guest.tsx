"use client";

import { type InsiderConfig, type TableView } from "@insider/sdk";
import { Download, KeyRound, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { selectGuest, updateFloor, useFloorStore } from "@/lib/floor-store";
import { exportGuest, importGuest } from "@/lib/guest";
import { friendlyError } from "@/lib/errors";
import { seatAvailable } from "@/lib/onboarding";
import { useJoin } from "./use-join";
import { WalletPlayButton } from "./wallet";

export function GuestControls({ config, view }: { config: InsiderConfig; view: TableView }) {
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const session = useFloorStore((state) => state.session);
  const joinRequested = useFloorStore((state) => state.joinRequested);
  const [settings, setSettings] = useState(false);
  const [importText, setImportText] = useState("");
  const snapshot = useFloorStore((state) => state.snapshot);
  // A saved guest key that already holds a seat can always come back to it.
  const guestSeated = Boolean(
    guest && snapshot?.seats.some((s) => s.owner.equals(guest.publicKey)),
  );
  const tableFull = Boolean(snapshot && !guestSeated && !seatAvailable(snapshot));
  const fail = (error: unknown) => useToast.getState().add(friendlyError(error));
  const { joining, seat, joinAsGuest } = useJoin(config);
  useEffect(() => {
    if (!joinRequested) return;
    // Deferred so a table left over from an earlier visit is never joined: the floor resets it
    // first, which unmounts these controls until the fresh table arrives.
    const timer = setTimeout(() => {
      updateFloor({ joinRequested: false });
      void seat();
    }, 0);
    return () => clearTimeout(timer);
  }, [identity, joinRequested, seat]);
  const download = () => {
    if (!guest) return;
    const url = URL.createObjectURL(new Blob([exportGuest(guest)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "insider-guest-key.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="relative flex items-center gap-2">
        {!view.mine && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void joinAsGuest()}
              loading={joining}
              disabled={tableFull}
              title={tableFull ? "Every seat is busy right now" : undefined}
            >
              {tableFull ? "Table full" : "Play as guest"}
            </Button>
            <WalletPlayButton size="sm" onReady={() => seat()} />
          </div>
        )}
        {view.mine && identity === "guest" && (
          <WalletPlayButton size="sm" compact onReady={() => seat()} />
        )}
        {view.mine && identity === "wallet" && (
          <Button size="sm" variant="outline" onClick={() => void joinAsGuest()} loading={joining}>
            Play as guest
          </Button>
        )}
        {identity === "wallet" && (
          <span className="text-muted hidden text-[10px] lg:inline">
            {session ? "Fast mode active" : "Each action asks your wallet"}
          </span>
        )}
        {identity === "guest" && (
          <button
            type="button"
            aria-label="Guest key settings"
            aria-expanded={settings}
            className="border-line-strong text-muted hover:text-text grid size-8 place-items-center rounded border"
            onClick={() => setSettings(!settings)}
          >
            <Settings2 className="size-3.5" />
          </button>
        )}
        {identity === "guest" && settings && (
          <div className="border-line-strong bg-surface absolute top-10 right-0 z-40 w-72 rounded-lg border p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Guest key</span>
              <KeyRound className="text-sealed size-4" />
            </div>
            <p className="text-muted mt-2 text-[11px] leading-5">
              Your key stays in this browser. Save it to keep your seat. Anyone with the key can use
              it.
            </p>
            <div className="text-faint mt-2 truncate font-mono text-[9px]">
              {guest?.publicKey.toBase58() ?? "No guest key yet"}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!guest}
                className="flex-1 text-[10px]"
                onClick={() => {
                  if (guest)
                    void navigator.clipboard
                      .writeText(exportGuest(guest))
                      .then(() => useToast.getState().add("Guest key copied. Keep it private."))
                      .catch(fail);
                }}
              >
                Copy JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!guest}
                className="flex-1 text-[10px]"
                onClick={download}
              >
                <Download className="size-3" /> Download
              </Button>
            </div>
            <label htmlFor="guest-import" className="micro-label mt-4 block">
              Import JSON key
            </label>
            <textarea
              id="guest-import"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              className="border-line-strong bg-bg mt-1 h-16 w-full resize-none rounded border p-2 font-mono text-[10px] outline-none"
              placeholder="[12, 34, …]"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-1 w-full text-[10px]"
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  const key = importGuest(importText);
                  selectGuest(key);
                  setImportText("");
                  setSettings(false);
                  useToast.getState().add("Guest key imported.");
                } catch (error) {
                  fail(error);
                }
              }}
            >
              Import key
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
