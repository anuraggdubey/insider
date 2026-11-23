"use client";

import { teeConnection } from "@insider/sdk";
import { useWallet } from "@solana/wallet-adapter-react";
import { type PublicKey } from "@solana/web3.js";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Num } from "@/components/ui/num";
import { useFloorStore } from "@/lib/floor-store";
import { loadGuest } from "@/lib/guest";
import { deriveSeason, fetchSeason, fixtureSeason, shortKey, type SeasonData } from "@/lib/season";
import { loadRounds, type ArchivedRound } from "@/lib/xray-archive";

const signed = (value: bigint) => `${value > BigInt(0) ? "+" : ""}${value.toLocaleString("en-US")}`;

export function SeasonView() {
  const config = useInsider();
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const guest = useFloorStore((state) => state.guest);
  const { publicKey: walletKey, connected } = useWallet();
  const [storedGuest, setStoredGuest] = useState<PublicKey | null>(null);
  const [data, setData] = useState<SeasonData | null>(null);
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [rounds, setRounds] = useState<ArchivedRound[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let closed = false;
    const load = async () => {
      let savedGuest: PublicKey | null = null;
      try {
        savedGuest = loadGuest()?.publicKey ?? null;
        setStoredGuest(savedGuest);
      } catch {
        setStoredGuest(null);
      }
      setRounds(loadRounds(fixture));
      setStatus("loading");
      try {
        const result = fixture
          ? fixtureSeason(useFloorStore.getState().fixture?.snapshot.seats, walletKey ?? savedGuest)
          : config.tableAuthority
            ? await fetchSeason(await teeConnection(config), config)
            : null;
        if (closed) return;
        setData(result);
        setStatus(result ? "online" : "offline");
      } catch {
        if (!closed) {
          setData(null);
          setStatus("offline");
        }
      }
    };
    void load();
    return () => {
      closed = true;
    };
  }, [config, fixture, refresh, walletKey]);
  const season = useMemo(() => {
    const identities = [guest?.publicKey ?? storedGuest, connected ? walletKey : null].filter(
      (key): key is PublicKey => Boolean(key),
    );
    return data ? deriveSeason(data, identities) : null;
  }, [data, guest, storedGuest, connected, walletKey]);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="micro-label text-sealed">Performance / Season</div>
          <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">The long game.</h1>
          <p className="text-muted mt-3 max-w-xl text-sm leading-6">
            The best round for every player, on chain. A season is more than one good read.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fixture && <Badge tone="opened">Fixture</Badge>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefresh((value) => value + 1)}
            loading={status === "loading"}
          >
            <RefreshCw aria-hidden className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {status === "loading" && (
        <p role="status" className="text-muted mt-10 text-sm">
          Loading season…
        </p>
      )}
      {status === "offline" && (
        <section
          className="border-line bg-surface mt-10 rounded-lg border p-7"
          aria-label="Season offline"
        >
          <div className="micro-label">Season / unavailable</div>
          <h2 className="mt-3 text-xl font-medium">Season offline</h2>
          <p className="text-muted mt-2 max-w-xl text-sm leading-6">
            The table authority is not configured, the Season account is unavailable, or the TEE
            could not be reached. No live leaderboard is shown.
          </p>
        </section>
      )}
      {status === "online" && season && (
        <>
          {fixture && (
            <p className="text-opened mt-7 font-mono text-[10px] tracking-wider uppercase">
              Local fixture · simulated data, not on chain
            </p>
          )}
          <div className="border-line bg-surface mt-8 grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-3">
            {[
              ["Epoch", season.epoch],
              ["Rounds played", season.roundsPlayed],
              ["Ranked players", season.leaderboard.length],
            ].map(([label, value]) => (
              <div key={label} className="border-line border-r px-5 py-5 last:border-r-0">
                <div className="micro-label">{label}</div>
                <div className="mt-2 font-mono text-2xl tabular-nums">
                  <Num value={Number(value)} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <section aria-labelledby="leaderboard-title" className="min-w-0">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <div className="micro-label text-sealed">01 / Standings</div>
                  <h2 id="leaderboard-title" className="mt-2 text-xl font-medium">
                    Leaderboard
                  </h2>
                </div>
                <span className="text-faint font-mono text-[10px] uppercase">
                  Best round / top 20
                </span>
              </div>
              <div className="border-line bg-surface overflow-x-auto rounded-lg border">
                {season.leaderboard.length ? (
                  <table className="w-full min-w-[440px] text-left text-sm">
                    <thead className="border-line text-faint border-b font-mono text-[10px] uppercase">
                      <tr>
                        <th className="p-4 font-normal">Rank</th>
                        <th className="p-4 font-normal">Player</th>
                        <th className="p-4 text-right font-normal">Best score</th>
                        <th className="p-4 text-right font-normal">Rounds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {season.leaderboard.map((entry) => (
                        <tr
                          key={entry.owner.toBase58()}
                          className={`border-line border-b last:border-0 ${entry.isYou ? "bg-sealed/5" : ""}`}
                        >
                          <td className="text-faint p-4 font-mono text-xs">
                            {String(entry.rank).padStart(2, "0")}
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{entry.name}</span>
                            {entry.isYou && (
                              <span className="text-sealed ml-2 font-mono text-[10px] uppercase">
                                You
                              </span>
                            )}
                            <span className="text-faint mt-1 block font-mono text-[10px]">
                              {shortKey(entry.owner)}
                            </span>
                          </td>
                          <td
                            className={`p-4 text-right font-mono tabular-nums ${entry.score >= BigInt(0) ? "text-buy" : "text-sell"}`}
                          >
                            {signed(entry.score)}
                          </td>
                          <td className="text-muted p-4 text-right font-mono tabular-nums">
                            {entry.rounds}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted p-6 text-sm">No scores recorded this epoch yet.</p>
                )}
              </div>
            </section>
            <section aria-labelledby="analysts-title" className="min-w-0">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <div className="micro-label text-priority">02 / The desk</div>
                  <h2 id="analysts-title" className="mt-2 text-xl font-medium">
                    Analyst track record
                  </h2>
                </div>
                <span className="text-faint font-mono text-[10px] uppercase">Per seat</span>
              </div>
              <div className="border-line bg-surface overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[530px] text-left text-sm">
                  <thead className="border-line text-faint border-b font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-4 font-normal">Seat</th>
                      <th className="p-3 text-right font-normal">Calls</th>
                      <th className="p-3 text-right font-normal">Hits</th>
                      <th className="p-3 text-right font-normal">Streak</th>
                      <th className="p-3 text-right font-normal">Best</th>
                      <th className="p-4 text-right font-normal">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.analysts.map((row) => (
                      <tr
                        key={row.index}
                        className={`border-line border-b last:border-0 ${row.isYou ? "bg-sealed/5" : ""}`}
                      >
                        <td className="p-4">
                          <span className="text-faint mr-2 font-mono text-[10px]">
                            {String(row.index + 1).padStart(2, "0")}
                          </span>
                          {row.name}
                          {row.isYou && (
                            <span className="text-sealed ml-1 text-[10px] uppercase">You</span>
                          )}
                        </td>
                        <td className="text-muted p-3 text-right font-mono tabular-nums">
                          {row.calls}
                        </td>
                        <td className="text-muted p-3 text-right font-mono tabular-nums">
                          {row.hits}
                        </td>
                        <td className="text-muted p-3 text-right font-mono tabular-nums">
                          {row.streak}
                        </td>
                        <td className="text-muted p-3 text-right font-mono tabular-nums">
                          {row.bestStreak}
                        </td>
                        <td className="p-4 text-right font-mono tabular-nums">
                          {signed(row.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-faint mt-3 text-xs">
                Calls and their results are attributed to seats, not wallet history.
              </p>
            </section>
          </div>
        </>
      )}
      <section aria-labelledby="archive-title" className="border-line mt-12 border-t pt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="micro-label">03 / Local archive</div>
            <h2 id="archive-title" className="mt-2 text-xl font-medium">
              Rounds this browser saw
            </h2>
          </div>
          <span className="text-faint text-xs">Saved on this device, not a complete history.</span>
        </div>
        <div className="border-line bg-surface overflow-hidden rounded-lg border">
          {rounds.length ? (
            rounds.map((round) => {
              const query = new URLSearchParams({ authority: round.authority });
              if (fixture) query.set("fixture", "1");
              return (
                <Link
                  key={`${round.authority}-${round.round}`}
                  href={`/xray/${round.round}?${query}`}
                  className="border-line hover:bg-surface-2 flex items-center justify-between gap-4 border-b px-5 py-4 last:border-0"
                >
                  <span>
                    <span className="font-mono text-sm">
                      Round {String(round.round).padStart(2, "0")}
                    </span>
                    <span className="text-faint ml-3 font-mono text-[10px]">
                      {round.authority.slice(0, 4)}…{round.authority.slice(-4)}
                    </span>
                  </span>
                  <span className="text-muted flex items-center gap-3 text-xs">
                    {round.xray.orders.length} fills <ArrowUpRight aria-hidden className="size-4" />
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="text-muted p-6 text-sm">
              No completed rounds saved here yet. Keep the floor open through the X-ray to build
              your archive.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
