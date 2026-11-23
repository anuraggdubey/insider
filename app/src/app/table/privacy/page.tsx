"use client";

import { fetchTable, tableAccounts, teeConnection } from "@insider/sdk";
import { Keypair, type Connection, type PublicKey } from "@solana/web3.js";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useInsider } from "@/app/providers";
import { FloorSkeleton, TableOffline } from "@/components/floor/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { loadGuest } from "@/lib/guest";

type Result = "readable" | "not returned" | "error";
type Row = { name: string; guest: Result; anonymous: Result };

async function probe(connection: Connection, address: PublicKey): Promise<Result> {
  try {
    const account = await connection.getAccountInfo(address, "confirmed");
    return account?.data.length ? "readable" : "not returned";
  } catch {
    return "error";
  }
}

export default function PrivacyPage() {
  const config = useInsider();
  const [state, setState] = useState<"loading" | "offline" | "ready" | "error">("loading");
  const [guest, setGuest] = useState<Keypair | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const check = useCallback(
    async (key: Keypair) => {
      if (!config.tableAuthority) return;
      setBusy(true);
      setMessage("");
      try {
        const [anonymous, authenticated] = await Promise.all([
          teeConnection(config),
          teeConnection(config, key),
        ]);
        const p = tableAccounts(config.tableAuthority, config.programId);
        const addresses = [
          { name: "Mempool", address: p.mempool },
          { name: "Future", address: p.future },
          ...p.leakVaults.map((address, index) => ({ name: `Leak vault ${index + 1}`, address })),
        ];
        const next = await Promise.all(
          addresses.map(async ({ name, address }) => {
            const [guestResult, anonymousResult] = await Promise.all([
              probe(authenticated, address),
              probe(anonymous, address),
            ]);
            return { name, guest: guestResult, anonymous: anonymousResult };
          }),
        );
        setRows(next);
      } catch {
        setMessage("Could not authenticate or reach the TEE. No result was inferred.");
      } finally {
        setBusy(false);
      }
    },
    [config],
  );

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      if (!config.tableAuthority) {
        setState("offline");
        return;
      }
      try {
        const connection = await teeConnection(config);
        const snapshot = await fetchTable(connection, config);
        if (cancelled) return;
        if (!snapshot) {
          setState("offline");
          return;
        }
        const key = loadGuest();
        setGuest(key);
        setState("ready");
        if (key) void check(key);
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [config, check]);

  if (state === "loading") return <FloorSkeleton />;
  if (state === "offline") return <TableOffline privacy />;
  if (state === "error")
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-24">
        <h1 className="text-2xl">Privacy check unavailable</h1>
        <p className="text-muted mt-3 text-sm">
          Could not reach the TEE or read the public table. No privacy result was inferred.
        </p>
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <Link
        href="/table"
        className="text-muted hover:text-text inline-flex items-center gap-2 font-mono text-[10px]"
      >
        <ArrowLeft className="size-3" /> THE FLOOR
      </Link>
      <div className="mt-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="micro-label text-sealed">A live RPC check</span>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Can anyone see inside?</h1>
          <p className="text-muted mt-3 max-w-xl text-sm leading-6">
            The mempool and future are sealed from everyone. Only a Leak&apos;s owner or licensed
            readers should be able to read its opened vault.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!guest || busy}
          loading={busy}
          onClick={() => guest && void check(guest)}
        >
          Run check again
        </Button>
      </div>
      {!guest && (
        <div className="border-opened/30 bg-opened/5 text-opened mt-8 rounded border p-4 text-sm">
          No guest key found. Press Play or import a key on the floor, then return here.
        </div>
      )}
      {message && (
        <div className="border-sell/30 bg-sell/5 text-sell mt-8 rounded border p-4 text-sm">
          {message}
        </div>
      )}
      <Panel
        title="Direct account reads"
        action={<span className="micro-label">TEE RPC · current table</span>}
        className="mt-8"
      >
        <div className="border-line text-faint grid grid-cols-[1fr_160px_160px] border-b px-5 py-3 font-mono text-[10px]">
          <span>ACCOUNT</span>
          <span>YOUR GUEST TOKEN</span>
          <span>ANONYMOUS</span>
        </div>
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.name}
              className="border-line grid grid-cols-[1fr_160px_160px] items-center border-b px-5 py-3 last:border-0"
            >
              <span className="text-sm">{row.name}</span>
              {[row.guest, row.anonymous].map((result, i) => (
                <span key={i}>
                  <Badge
                    tone={
                      result === "readable"
                        ? "opened"
                        : result === "not returned"
                          ? "sealed"
                          : "neutral"
                    }
                  >
                    {result}
                  </Badge>
                </span>
              ))}
            </div>
          ))
        ) : (
          <p className="text-muted px-5 py-8 text-sm">
            {busy ? "Reading private accounts from both connections…" : "No check has been run."}
          </p>
        )}
      </Panel>
      <p className="text-faint mt-3 text-xs leading-5">
        “Not returned” means the RPC returned no account data; an RPC error is shown separately and
        is not evidence of privacy. Public end-of-round X-ray disclosures are a separate account.
      </p>
      <div className="border-line bg-surface mt-8 rounded-lg border p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="text-sealed size-4" /> Two-browser demonstration
        </div>
        <ol className="text-muted mt-4 list-inside list-decimal space-y-2 text-sm leading-6">
          <li>In browser A, claim a seat and open a Leak.</li>
          <li>In a separate browser B, use a different guest key and run this check.</li>
          <li>
            Compare the vault row with browser A. Only authorized readers should receive the
            payload.
          </li>
        </ol>
      </div>
    </main>
  );
}
