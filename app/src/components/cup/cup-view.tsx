"use client";

import { teeConnection } from "@insider/sdk";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useInsider } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  CUP_ROUNDS,
  fetchCup,
  fetchCupStatus,
  prizePool,
  tokens,
  type CupData,
  type CupStatus,
} from "@/lib/cup";

const OPERATOR = process.env.NEXT_PUBLIC_CUP_URL || "http://localhost:8789";

export function CupView() {
  const config = useInsider();
  const [cup, setCup] = useState<CupData | null>(null);
  const [operator, setOperator] = useState<CupStatus | null>(null);
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let closed = false;
    const load = async () => {
      const [chain, info] = await Promise.all([
        config.tableAuthority
          ? teeConnection(config)
              .then((connection) => fetchCup(connection, config))
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
  }, [config, refresh]);

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
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw aria-hidden className="size-3.5" /> Refresh
        </Button>
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

      {status === "online" && cup && (
        <div className="mt-10 space-y-8">
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

          <Panel
            title="Standings"
            label={
              cup.settled ? "settled" : cup.roundsRecorded === 0 ? "open for entries" : "in play"
            }
            action={
              <Badge tone={cup.settled ? "buy" : cup.roundsRecorded === 0 ? "sealed" : "opened"}>
                {cup.settled ? "Paid out" : cup.roundsRecorded === 0 ? "Open" : "Running"}
              </Badge>
            }
          >
            {cup.entries.length ? (
              <table className="w-full text-left text-sm">
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
            ) : (
              <p className="text-muted p-5 text-sm">No entrants yet.</p>
            )}
          </Panel>

          <Panel title="How to enter" label="human seats only">
            <ol className="text-muted list-decimal space-y-2 p-5 pl-9 text-sm leading-6">
              <li>
                Take a human seat (7 to 9) on the floor, with a wallet or this browser&apos;s guest
                key.
              </li>
              <li>
                Pay the buy-in
                {operator ? ` (${tokens(BigInt(operator.buyIn))} tokens of the cup token` : ""}
                {operator
                  ? `, mint ${operator.mint.slice(0, 4)}…${operator.mint.slice(-4)})`
                  : ""}{" "}
                to the operator with a private transfer, before the first round of a cup.
              </li>
              <li>
                The operator counts the buy-in, co-signs your join and the cup starts. Entry is by
                script for now: see the Alpha Cup section of docs/api.md.
              </li>
            </ol>
          </Panel>

          {operator && operator.history.length > 0 && (
            <Panel title="Past cups" label="paid privately">
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
