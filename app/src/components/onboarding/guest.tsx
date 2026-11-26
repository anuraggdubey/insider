"use client";

import { type InsiderConfig, type TableView } from "@insider/sdk";
import { Download, KeyRound, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { selectGuest, updateFloor, useFloorStore } from "@/lib/floor-store";
import { createGuest, exportGuest, importGuest } from "@/lib/guest";
import { friendlyError } from "@/lib/errors";
import { useDialogFocus } from "@/lib/dialog-focus";
import { FastModeToggle, WalletPlayButton } from "./wallet";

/**
 * Seat-taking used by every "take a seat" button: `joinAsGuest` uses this browser's guest key (made
 * on first use, free, no wallet); `joinFloor` claims a seat for whichever identity is active.
 */
export function useJoin(config: InsiderConfig) {
  const [busy, setBusy] = useState(false);
  const joinFloor = useCallback(
    async () => (await import("@/lib/floor-actions")).joinFloor(config),
    [config],
  );
  const joinAsGuest = useCallback(async () => {
    setBusy(true);
    try {
      selectGuest(createGuest());
      await joinFloor();
      return true;
    } catch (error) {
      useToast.getState().add(friendlyError(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, [joinFloor]);
  return { busy, joinAsGuest, joinFloor };
}

export function GuestControls({ config, view }: { config: InsiderConfig; view: TableView }) {
  const guest = useFloorStore((state) => state.guest);
  const identity = useFloorStore((state) => state.identity);
  const session = useFloorStore((state) => state.session);
  const joinRequested = useFloorStore((state) => state.joinRequested);
  const tutorial = useFloorStore((state) => state.tutorial);
  const [settings, setSettings] = useState(false);
  const [importText, setImportText] = useState("");
  const { busy, joinAsGuest, joinFloor } = useJoin(config);
  const dialog = useDialogFocus(Boolean(tutorial && view.mine), () =>
    updateFloor({ tutorial: false }),
  );
  const fail = (error: unknown) => useToast.getState().add(friendlyError(error));
  const join = () => void joinAsGuest();
  useEffect(() => {
    if (!joinRequested || identity !== "wallet") return;
    updateFloor({ joinRequested: false });
    void joinFloor().catch((error) => useToast.getState().add(friendlyError(error)));
  }, [identity, joinRequested, joinFloor]);
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
            <Button size="sm" onClick={join} loading={busy}>
              Take a free seat
            </Button>
            <WalletPlayButton size="sm" onReady={joinFloor} />
          </div>
        )}
        {view.mine && identity === "guest" && (
          <WalletPlayButton size="sm" compact onReady={joinFloor} />
        )}
        {view.mine && identity === "wallet" && (
          <Button size="sm" variant="outline" onClick={join} loading={busy}>
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
      {tutorial && view.mine && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-5"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to the floor"
          ref={dialog}
          tabIndex={-1}
        >
          <div className="border-line-strong bg-surface relative w-full max-w-md rounded-xl border p-8">
            <button
              type="button"
              aria-label="Close"
              onClick={() => updateFloor({ tutorial: false })}
              className="text-muted absolute top-4 right-4"
            >
              <X className="size-4" />
            </button>
            <span className="micro-label text-brand">You&apos;re in</span>
            <h2 className="mt-2 text-xl font-medium">
              You are {view.mine.name}, seat {view.mine.index + 1}
            </h2>
            <p className="text-muted mt-2 text-sm">
              You have 1,000 play chips.{" "}
              {identity === "wallet"
                ? session
                  ? "Fast mode is active."
                  : "Each action asks your wallet."
                : "Your key stays on this device."}
            </p>
            {identity === "wallet" && (
              <div className="mt-4">
                <FastModeToggle walletOnly />
              </div>
            )}
            <div className="border-line mt-6 space-y-4 border-t pt-5">
              {[
                [
                  "01",
                  "Pick Buy or Sell",
                  "In the Action pad: Buy if you think the price goes up, Sell if down.",
                ],
                [
                  "02",
                  "Send it",
                  "Your order stays hidden for a few seconds, then lands at the price of that moment.",
                ],
                [
                  "03",
                  "Grab a capsule",
                  "Capsules (below the chart) leak other players' hidden orders. Open one and trade first.",
                ],
              ].map(([n, title, text]) => (
                <div key={n} className="flex gap-4">
                  <span className="text-brand font-mono text-xs">{n}</span>
                  <div>
                    <div className="text-sm">{title}</div>
                    <p className="text-muted mt-1 text-xs">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-7 w-full" onClick={() => updateFloor({ tutorial: false })}>
              Start trading
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
