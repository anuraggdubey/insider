"use client";

import { baseConnection, teeConnection, type InsiderConfig } from "@insider/sdk";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Stamp } from "@/components/ui/stamp";
import { useFloorStore } from "@/lib/floor-store";
import { requestWallet } from "@/lib/wallet-ui";
import { fetchCup, fetchCupStatus, tokens, type CupData, type CupStatus } from "@/lib/cup";
import {
  balances,
  checkCupStatus,
  claimHumanSeat,
  cupProgressStore,
  humanSeats,
  payCup,
  submitCupJoin,
  withCupLock,
  type CupProgress,
} from "@/lib/cup-join";
import { BrowserPayments } from "@/lib/payments";

export default function CupJoinCard({
  config,
  status,
  cup,
  operatorUrl,
  fixture,
  onJoined,
}: {
  config: InsiderConfig;
  status: CupStatus;
  cup: CupData;
  operatorUrl: string;
  fixture: boolean;
  onJoined?: () => void;
}) {
  const wallet = useFloorStore((state) => state.wallet);
  const walletKey = useFloorStore((state) => state.walletKey);
  const [seat, setSeat] = useState<number | undefined>();
  const [free, setFree] = useState<number | undefined>();
  const [funds, setFunds] = useState<{ lamports: number; token: bigint } | null>(null);
  const [progress, setProgress] = useState<CupProgress | null>(null);
  const [creditReady, setCreditReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const owner = walletKey?.toBase58();
  const alreadyJoined = Boolean(owner && cup.entries.some((entry) => entry.owner === owner));

  useEffect(() => {
    let closed = false;
    const load = async () => {
      if (fixture || !walletKey || status.cupId === undefined) {
        setSeat(undefined);
        setFree(undefined);
        setFunds(null);
        setProgress(null);
        setCreditReady(false);
        return;
      }
      setSeat(undefined);
      setFree(undefined);
      setFunds(null);
      setCreditReady(false);
      try {
        const saved = cupProgressStore(walletKey.toBase58(), status.cupId!).read();
        const [connection, base] = await Promise.all([
          teeConnection(config),
          Promise.resolve(baseConnection(config)),
        ]);
        const [human, money] = await Promise.all([
          humanSeats(connection, config, walletKey),
          balances(base, walletKey, new PublicKey(status.mint)),
        ]);
        if (!closed) {
          setSeat(human.mine);
          setFree(human.free);
          setFunds(money);
          setProgress(saved);
          setError("");
        }
      } catch {
        if (!closed)
          setError("Could not read your seat or balances. Check the connection and retry.");
      }
    };
    const timer = setTimeout(() => void load(), 0);
    return () => {
      closed = true;
      clearTimeout(timer);
    };
  }, [config, fixture, owner, refresh, status.cupId, status.mint, walletKey]);

  const run = async (name: string, action: () => Promise<void>) => {
    if (!wallet || !walletKey?.equals(wallet.publicKey)) {
      setError("Connect a wallet that supports message and transaction signing.");
      return;
    }
    setBusy(name);
    setError("");
    try {
      if (name === "pay" || name === "join") {
        if (status.cupId === undefined) throw new Error("Cup ID is unavailable.");
        await withCupLock(wallet.publicKey.toBase58(), status.cupId, action);
      } else await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy("");
    }
  };
  const getStatus = () => fetchCupStatus(operatorUrl);
  const refreshState = () => setRefresh((value) => value + 1);
  const cupOpen = Boolean(
    status.open && !cup.settled && cup.roundsRecorded === 0 && cup.cupId === status.cupId,
  );
  const hasFunds = Boolean(funds && funds.token >= BigInt(status.buyIn));
  const hasSol = Boolean(funds && funds.lamports >= 10_000_000);
  const paid = progress?.stage === "paid";
  const buyInSent = Boolean(progress?.transferSignature);
  const pending =
    progress?.stage === "deposit_pending" ||
    progress?.stage === "transfer_pending" ||
    progress?.stage === "join_pending";
  const isCurrent = () =>
    Boolean(wallet && useFloorStore.getState().walletKey?.equals(wallet.publicKey));

  async function confirmSeatAndCup() {
    if (!wallet) throw new Error("Connect your wallet.");
    const connection = await teeConnection(config);
    const [human, chain, latest] = await Promise.all([
      humanSeats(connection, config, wallet.publicKey),
      fetchCup(connection, config),
      getStatus(),
    ]);
    if (human.mine === undefined) throw new Error("Claim a human seat first.");
    if (
      !chain ||
      !latest ||
      chain.cupId !== status.cupId ||
      chain.roundsRecorded !== 0 ||
      chain.settled
    )
      throw new Error("The cup is no longer open.");
    if (chain.entries.some((entry) => entry.owner === wallet.publicKey.toBase58()))
      throw new Error("This wallet has already joined.");
    checkCupStatus(latest, config, chain.cupId);
    if (
      progress &&
      (progress.mint !== latest.mint ||
        progress.buyIn !== latest.buyIn ||
        progress.operator !== latest.operator)
    )
      throw new Error("The saved payment no longer matches this cup. Contact the operator.");
    return { connection, seat: human.mine, latest };
  }

  return (
    <Panel title="Enter the cup" label="wallet · human seats only">
      <div className="space-y-3 p-5">
        {process.env.NODE_ENV !== "production" && fixture ? (
          <>
            <p className="text-opened text-xs">
              Fixture preview only. No wallet, token transfer or join is performed.
            </p>
            <ol className="space-y-3">
              {[
                ["01 / Wallet", "Connected"],
                ["02 / Human seat", "Seat 8"],
                ["03 / Cup", status.open ? "Open" : "Closed"],
                [
                  "04 / Test tokens",
                  `${tokens(BigInt(status.buyIn) * BigInt(2))} / ${tokens(BigInt(status.buyIn))}`,
                ],
                ["05 / Fees", "0.080 SOL"],
                ["06 / Private buy-in", "Not sent"],
              ].map(([label, value]) => (
                <li
                  key={label}
                  className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3"
                >
                  <span>{label}</span>
                  <span className="text-muted font-mono text-xs">{value}</span>
                </li>
              ))}
            </ol>
            <Button size="sm" disabled>
              Pay buy-in privately
            </Button>
          </>
        ) : (
          <>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <span>
                01 / Wallet {owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "not connected"}
              </span>
              {!walletKey ? (
                <Button size="sm" onClick={() => requestWallet("select")}>
                  Connect wallet
                </Button>
              ) : (
                <Stamp className={wallet ? "text-buy" : "text-sell"}>
                  {wallet ? "Connected" : "Signing unsupported"}
                </Stamp>
              )}
            </div>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <span>
                02 / Human seat{" "}
                {seat !== undefined
                  ? `${seat + 1} held (index ${seat})`
                  : free === undefined && funds
                    ? "· all human seats taken"
                    : "required"}
              </span>
              {seat === undefined && walletKey && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === "seat"}
                  disabled={free === undefined || Boolean(busy)}
                  onClick={() =>
                    void run("seat", async () => {
                      await claimHumanSeat(config, wallet!);
                      refreshState();
                    })
                  }
                >
                  Claim seat
                </Button>
              )}
              {seat !== undefined && <Stamp className="text-buy">Ready</Stamp>}
            </div>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <span>03 / Cup {cupOpen ? "open" : "not open"}</span>
              <Stamp className={cupOpen ? "text-buy" : "text-muted"}>
                {cupOpen ? "Open" : "Closed"}
              </Stamp>
            </div>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <span>
                04 / Test tokens{" "}
                {funds ? `${tokens(funds.token)} / ${tokens(BigInt(status.buyIn))}` : "—"}
              </span>
              {!hasFunds && walletKey && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === "faucet"}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("faucet", async () => {
                      const response = await fetch(`${operatorUrl.replace(/\/$/, "")}/cup/faucet`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ owner }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error || "Token faucet failed.");
                      refreshState();
                    })
                  }
                >
                  Get test tokens
                </Button>
              )}
              {hasFunds && <Stamp className="text-buy">Ready</Stamp>}
            </div>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <span>
                05 / Fees {funds ? `${(funds.lamports / 1e9).toFixed(3)} SOL` : "—"} · 0.01 SOL
                minimum
              </span>
              {!hasSol ? (
                <a
                  className="text-opened text-xs underline"
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get devnet SOL ↗
                </a>
              ) : (
                <Stamp className="text-buy">Ready</Stamp>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>06 / Private buy-in {buyInSent ? "sent" : "not sent"}</span>
              {alreadyJoined || progress?.stage === "joined" ? (
                <Stamp className="text-buy">Joined</Stamp>
              ) : creditReady ? (
                <Button
                  size="sm"
                  loading={busy === "join"}
                  disabled={Boolean(busy) || !cupOpen}
                  onClick={() =>
                    void run("join", async () => {
                      const { seat: selected, connection } = await confirmSeatAndCup();
                      const signedConnection = await teeConnection(config, wallet!);
                      void connection;
                      const store = cupProgressStore(owner!, status.cupId!);
                      let signature: string;
                      try {
                        signature = await submitCupJoin(
                          config,
                          wallet!,
                          selected,
                          operatorUrl,
                          signedConnection,
                          store,
                          isCurrent,
                        );
                      } finally {
                        const saved = store.read();
                        setProgress(saved);
                        if (saved?.stage === "join_pending") setCreditReady(false);
                      }
                      setCreditReady(false);
                      setError("");
                      refreshState();
                      onJoined?.();
                      if (!signature) throw new Error("No join signature returned.");
                    })
                  }
                >
                  Join cup
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={busy === "pay"}
                  disabled={
                    Boolean(busy) ||
                    !wallet ||
                    seat === undefined ||
                    !cupOpen ||
                    !hasSol ||
                    (!hasFunds &&
                      !paid &&
                      progress?.stage !== "deposited" &&
                      progress?.stage !== "ready") ||
                    pending
                  }
                  onClick={() =>
                    void run("pay", async () => {
                      const { latest } = await confirmSeatAndCup();
                      const result = await payCup({
                        wallet: wallet!,
                        status: latest,
                        config,
                        payments: new BrowserPayments(baseConnection(config), wallet!),
                        store: cupProgressStore(owner!, latest.cupId!),
                        getStatus,
                        isCurrent,
                        onProgress: setProgress,
                      });
                      setProgress(result);
                      setCreditReady(true);
                    })
                  }
                >
                  {paid
                    ? "Check payment credit"
                    : progress?.stage === "deposited"
                      ? "Continue buy-in"
                      : "Pay buy-in privately"}
                </Button>
              )}
            </div>
            {pending && !alreadyJoined && (
              <p className="text-sell text-xs">
                A transaction outcome is unknown. Check your wallet and contact the operator before
                retrying; do not pay again.
              </p>
            )}
            {progress?.depositSignature && (
              <a
                className="text-opened block text-xs break-all underline"
                href={`https://explorer.solana.com/tx/${progress.depositSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Deposit receipt ↗
              </a>
            )}
            {progress?.transferSignature && (
              <p className="text-muted font-mono text-[10px] break-all">
                Private transfer: {progress.transferSignature}
              </p>
            )}
            {progress?.joinSignature && (
              <a
                className="text-opened block text-xs break-all underline"
                href={`https://explorer.solana.com/tx/${progress.joinSignature}?cluster=custom&customUrl=${encodeURIComponent(config.teeRpcUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                Join receipt ↗
              </a>
            )}
            {error && (
              <p role="alert" className="text-sell text-xs">
                {error}{" "}
                <button className="underline" onClick={refreshState}>
                  Retry checks
                </button>
              </p>
            )}
            <p className="text-faint text-xs">
              The operator counts private transfers as shared credits, not by sender. Each payment
              and join asks your wallet.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
