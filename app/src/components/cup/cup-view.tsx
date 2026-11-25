"use client";

import { RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Capsule } from "@/components/ui/capsule";
import { Stamp } from "@/components/ui/stamp";
import {
  CUP_ROUNDS,
  fetchCupStatus,
  prizePool,
  tokens,
  type CupData,
  type CupStatus,
} from "@/lib/cup-common";

const OPERATOR = process.env.NEXT_PUBLIC_CUP_URL || "";
const CupJoinCard = dynamic(() => import("./cup-join-card"), { ssr: false });

export function CupView() {
  const config = useInsider();
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const [fixtureSettled, setFixtureSettled] = useState(false);
  const [cup, setCup] = useState<CupData | null>(null);
  const [operator, setOperator] = useState<CupStatus | null>(null);
  const [status, setStatus] = useState<"loading" | "online" | "offline" | "operator-offline">(
    "loading",
  );
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let closed = false;
    const load = async () => {
      if (process.env.NODE_ENV !== "production" && fixture) {
        const result = (await import("@/lib/cup-fixture")).fixtureCup(fixtureSettled);
        if (!closed) {
          setCup(result.cup);
          setOperator(result.operator);
          setStatus("online");
        }
        return;
      }
      if (!OPERATOR) {
        if (!closed) {
          setCup(null);
          setOperator(null);
          setStatus("operator-offline");
        }
        return;
      }
      const [chain, info] = await Promise.all([
        config.tableAuthority
          ? Promise.all([import("@insider/sdk/connection"), import("@/lib/cup")])
              .then(async ([{ teeConnection }, { fetchCup }]) =>
                fetchCup(await teeConnection(config), config),
              )
              .catch(() => null)
          : Promise.resolve(null),
        fetchCupStatus(OPERATOR),
      ]);
      if (closed) return;
      setCup(chain);
      setOperator(info);
      setStatus(chain ? "online" : "offline");
    };
    void load();
    const timer = setInterval(load, 6_000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [config, fixture, fixtureSettled, refresh]);

  const pool =
    cup && operator && cup.entrants > 0
      ? prizePool(cup.entrants, operator.buyIn, operator.feeBps)
      : null;
  const prizeFor = (bps: number) =>
    pool ? tokens((pool.prizes * BigInt(bps)) / BigInt(10_000)) : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="micro-label text-whale">Competition / Alpha Cup</div>
          <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
            Five rounds. Real prizes.
          </h1>
          <p className="text-muted mt-3 max-w-xl text-sm leading-6">
            Human seats buy in privately, play five rounds and the top three are paid privately:
            50/30/20 (60/40 for two, all for one) after a {operator ? operator.feeBps / 100 : 5}%
            platform fee. Bots and analysts cannot win.
          </p>
          {fixture && (
            <Badge tone="opened" className="mt-3">
              Fixture · simulated data
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {fixture && (
            <Button variant="outline" size="sm" onClick={() => setFixtureSettled(!fixtureSettled)}>
              {fixtureSettled ? "Show open cup" : "Show settled cup"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
            <RefreshCw aria-hidden className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {status === "loading" && (
        <p role="status" className="text-muted mt-10 text-sm">
          Loading the cup…
        </p>
      )}
      {status === "offline" && (
        <section
          className="border-line bg-surface mt-10 rounded-lg border p-7"
          aria-label="Cup offline"
        >
          <div className="micro-label">Cup / unavailable</div>
          <h2 className="mt-3 text-xl font-medium">The cup is offline</h2>
          <p className="text-muted mt-2 max-w-xl text-sm leading-6">
            The table authority is not configured or the private rollup could not be reached.
          </p>
        </section>
      )}
      {status === "operator-offline" && (
        <section
          className="border-line bg-surface mt-10 rounded-lg border p-7"
          aria-label="Cup operator offline"
        >
          <div className="micro-label">Cup / unavailable</div>
          <h2 className="mt-3 text-xl font-medium">Cup operator offline</h2>
          <p className="text-muted mt-2 text-sm">
            The operator is not configured. No buy-in or standings are available.
          </p>
        </section>
      )}

      {status === "online" && cup && (
        <div className="mt-10 space-y-8">
          <section className="border-ink bg-surface flex flex-wrap items-center gap-5 rounded-xl border-2 p-5">
            <Capsule rarity="epic" size={64} motion="none" />
            <div className="min-w-0 flex-1">
              <div className="micro-label">Tournament / entry ticket</div>
              <h2 className="mt-1 text-xl font-bold">Alpha Cup #{cup.cupId}</h2>
              <p className="text-muted mt-1 text-xs">
                Five rounds · private buy-in · human seats only
              </p>
            </div>
            <Stamp className={cup.settled ? "text-buy" : "text-sealed"}>
              {cup.settled ? "Settled" : cupOpen(cup, operator) ? "Open" : "In play"}
            </Stamp>
          </section>
          <div className="border-line bg-surface grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4">
            {[
              ["Cup", `#${cup.cupId}`],
              ["Rounds", `${cup.roundsRecorded} / ${CUP_ROUNDS}`],
              ["Entrants", String(cup.entrants || cup.entries.length)],
              ["Buy-in", operator ? `${tokens(BigInt(operator.buyIn))} tokens` : "unknown"],
            ].map(([label, value]) => (
              <div key={label} className="border-line border-r px-5 py-5 last:border-r-0">
                <div className="micro-label">{label}</div>
                <div className="mt-2 font-mono text-xl tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          {operator && (
            <CupJoinCard
              config={config}
              status={operator}
              cup={cup}
              operatorUrl={OPERATOR}
              fixture={fixture}
              onJoined={() => setRefresh((value) => value + 1)}
            />
          )}
          <Panel
            title="Standings"
            label={
              cup.settled ? "settled" : cup.roundsRecorded === 0 ? "open for entries" : "in play"
            }
            action={
              <Badge tone={cup.settled ? "buy" : cup.roundsRecorded === 0 ? "sealed" : "opened"}>
                {cup.settled ? "Settled" : cup.roundsRecorded === 0 ? "Open" : "Running"}
              </Badge>
            }
          >
            {cup.entries.length ? (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Cup standings"
                tabIndex={0}
              >
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="border-line text-faint border-b font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-4 font-normal">Rank</th>
                      <th className="p-4 font-normal">Player</th>
                      <th className="p-4 text-right font-normal">Score</th>
                      <th className="p-4 text-right font-normal">Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cup.entries.map((entry, index) => {
                      const winner = cup.winners.find((w) => w.owner === entry.owner);
                      return (
                        <tr key={entry.owner} className="border-line border-b last:border-0">
                          <td className="text-faint p-4 font-mono text-xs">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td className="p-4">
                            {entry.name}
                            <span className="text-faint ml-2 font-mono text-[10px]">
                              seat {entry.seat + 1}
                            </span>
                          </td>
                          <td
                            className={`p-4 text-right font-mono tabular-nums ${entry.score >= 0 ? "text-buy" : "text-sell"}`}
                          >
                            {entry.score > 0 ? "+" : ""}
                            {entry.score.toLocaleString("en-US")}
                          </td>
                          <td className="text-muted p-4 text-right font-mono text-xs">
                            {winner
                              ? `${winner.bps / 100}%${prizeFor(winner.bps) ? ` · ${prizeFor(winner.bps)} tokens` : ""}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted p-5 text-sm">No entrants yet.</p>
            )}
          </Panel>
          {cup.settled && !operator?.history.some((entry) => entry.cup === cup.cupId) && (
            <p className="text-muted text-xs">
              Winners are fixed; private payouts are not yet confirmed by the operator.
            </p>
          )}

          {operator && operator.history.length > 0 && (
            <Panel title="Payout confirmation" label="paid privately">
              <ul>
                {[...operator.history].reverse().map((entry) => (
                  <li
                    key={entry.cup}
                    className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm last:border-0"
                  >
                    <span>
                      Cup #{entry.cup}
                      <span className="text-faint ml-3 font-mono text-[10px]">
                        {entry.entrants} entrants · pot {tokens(BigInt(entry.pot))} · fee{" "}
                        {tokens(BigInt(entry.fee))}
                      </span>
                    </span>
                    <span className="text-muted font-mono text-xs">
                      {entry.prizes.map((p) => tokens(BigInt(p.amount))).join(" / ")} tokens
                    </span>
                    <div className="flex w-full flex-wrap gap-3">
                      {entry.prizes.map((prize) =>
                        fixture ? (
                          <span key={prize.to} className="text-faint text-[10px]">
                            Simulated payout · {tokens(BigInt(prize.amount))}
                          </span>
                        ) : (
                          <span
                            key={prize.to}
                            className="text-faint font-mono text-[10px] break-all"
                          >
                            Private payout · {prize.signature}
                          </span>
                        ),
                      )}
                      {!fixture && (
                        <a
                          className="text-opened text-xs underline"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://explorer.solana.com/tx/${entry.closed}?cluster=custom&customUrl=${encodeURIComponent(config.teeRpcUrl)}`}
                        >
                          Cup close receipt ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {!operator && (
            <p className="text-faint text-xs">
              The cup operator is not answering, so prices and past cups are hidden. Standings above
              come straight from the chain.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function cupOpen(cup: CupData, status: CupStatus | null) {
  return Boolean(
    status?.open && !cup.settled && cup.roundsRecorded === 0 && status.cupId === cup.cupId,
  );
}
