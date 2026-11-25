"use client";

import { useEffect, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { useFloorStore } from "@/lib/floor-store";
import { requestWallet } from "@/lib/wallet-ui";
import type { SoarReceipt } from "@/lib/soar";

export function SoarCard() {
  const config = useInsider();
  const wallet = useFloorStore((state) => state.wallet);
  const walletKey = useFloorStore((state) => state.walletKey);
  const [status, setStatus] = useState<"connect" | "checking" | "registered" | "missing" | "error">(
    "connect",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [receipts, setReceipts] = useState<SoarReceipt[]>([]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setReceipts([]);
      setError("");
      if (!walletKey) {
        setStatus("connect");
        return;
      }
      setStatus("checking");
      void import("@/lib/soar")
        .then(async ({ loadSoar, soarRegistered }) => {
          const { connection, client, leaderboard } = await loadSoar(config, walletKey);
          const registered = await soarRegistered(connection, client, walletKey, leaderboard);
          if (!cancelled) setStatus(registered ? "registered" : "missing");
        })
        .catch(() => {
          if (!cancelled) {
            setStatus("error");
            setError("Could not check SOAR on the base network.");
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, walletKey, refresh]);

  const register = async () => {
    if (!wallet || !walletKey?.equals(wallet.publicKey)) return;
    setBusy(true);
    setError("");
    try {
      const { loadSoar, registerSoar } = await import("@/lib/soar");
      const { connection, client, leaderboard } = await loadSoar(config, wallet.publicKey);
      await registerSoar(
        connection,
        client,
        wallet,
        leaderboard,
        (receipt) => {
          if (useFloorStore.getState().walletKey?.equals(wallet.publicKey))
            setReceipts((current) => [...current, receipt]);
        },
        () => Boolean(useFloorStore.getState().walletKey?.equals(wallet.publicKey)),
      );
      if (useFloorStore.getState().walletKey?.equals(wallet.publicKey)) setStatus("registered");
    } catch (cause) {
      if (useFloorStore.getState().walletKey?.equals(wallet.publicKey))
        setError(cause instanceof Error ? cause.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="soar-title"
      className="border-ink bg-surface mt-8 rounded-xl border-2 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Capsule rarity="epic" size={54} motion="none" />
        <div className="min-w-0 flex-1">
          <div className="micro-label">SOAR / BASE LAYER</div>
          <h2 id="soar-title" className="mt-1 text-lg font-bold">
            Get on the SOAR leaderboard
          </h2>
          <p className="text-muted mt-2 text-xs leading-5">
            The game authority publishes season scores to SOAR after each epoch; registered wallets
            only.
          </p>
        </div>
        <Badge tone={status === "registered" ? "buy" : "neutral"}>
          {status === "registered"
            ? "Registered"
            : status === "missing"
              ? "Not registered"
              : status === "checking"
                ? "Checking"
                : status === "error"
                  ? "Unavailable"
                  : "Wallet required"}
        </Badge>
        {!walletKey ? (
          <Button size="sm" variant="outline" onClick={() => requestWallet("select")}>
            Connect wallet
          </Button>
        ) : status === "error" ? (
          <Button size="sm" variant="outline" onClick={() => setRefresh((value) => value + 1)}>
            Retry
          </Button>
        ) : status !== "registered" ? (
          <Button
            size="sm"
            disabled={status !== "missing" || !wallet}
            loading={busy}
            onClick={() => void register()}
          >
            Register
          </Button>
        ) : null}
      </div>
      <p className="text-muted mt-3 text-xs">
        Registration asks for up to two wallet signatures and a little devnet SOL for fees and rent.
      </p>
      {error && (
        <p role="alert" className="text-sell mt-2 text-xs">
          {error}{" "}
          <a
            className="underline"
            href="https://faucet.solana.com/"
            target="_blank"
            rel="noreferrer"
          >
            Devnet faucet
          </a>
        </p>
      )}
      {receipts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {receipts.map(({ step, signature }) => (
            <a
              key={signature}
              className="text-opened underline"
              target="_blank"
              rel="noreferrer"
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            >
              {step === "player" ? "Player account" : "Leaderboard entry"} transaction ↗
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
