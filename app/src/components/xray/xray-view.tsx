"use client";

import { CLOSING_END_TICK } from "@insider/sdk";
import { ArrowLeft, ArrowUpRight, Copy, Pause, Play, RotateCcw, Share2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInsider } from "@/app/providers";
import { FloorSkeleton } from "@/components/floor/states";
import { useFloor } from "@/components/floor/use-floor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { useFloorStore } from "@/lib/floor-store";
import { playSound } from "@/lib/sound";
import { crossedSandwich } from "@/lib/sound-events";
import { createRoundObserver, findRound, type ArchivedRound } from "@/lib/xray-archive";
import {
  LEAK_KINDS,
  RARITIES,
  publicPayload,
  roundSeats,
  sandwichOrders,
  shareDetails,
  traceName,
} from "@/lib/xray-data";
import { ReplayChart } from "./replay-chart";

function Scoreboard({ round }: { round: ArchivedRound }) {
  const seats = roundSeats(round)
    .filter((seat) => !seat.free)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  return (
    <Panel title="Scoreboard" label="After close-out" className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[510px] text-left text-xs">
          <thead className="text-muted border-line border-b font-mono text-[10px] uppercase">
            <tr>
              <th className="px-4 py-3 font-normal">Seat</th>
              <th className="px-3 py-3 font-normal">Kind</th>
              <th className="px-3 py-3 font-normal">Held / opened</th>
              <th className="px-3 py-3 font-normal">Best tagged</th>
              <th className="px-4 py-3 text-right font-normal">Score</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat) => {
              const held = round.xray.leaks.filter(
                (leak) => leak.header.ownerSeat === seat.index && leak.header.paid > 0,
              );
              const opened = held.filter((leak) => leak.header.openedTick > 0).length;
              const best = round.xray.tags
                .filter((tag) => tag.front === seat.index)
                .sort((a, b) => b.profitEstimate - a.profitEstimate)[0];
              return (
                <tr key={seat.index} className="border-line border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{seat.name}</td>
                  <td className="px-3 py-3">
                    <Badge>{seat.kind}</Badge>
                  </td>
                  <td className="text-muted px-3 py-3 font-mono">
                    {held.length} / {opened}
                  </td>
                  <td className="text-muted px-3 py-3 font-mono">
                    {best ? `${best.profitEstimate > 0 ? "+" : ""}${best.profitEstimate}` : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${seat.score === null ? "text-muted" : seat.score >= 0 ? "text-buy" : "text-sell"}`}
                  >
                    {seat.score === null
                      ? "Unavailable"
                      : `${seat.score > 0 ? "+" : ""}${seat.score}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {seats.some((seat) => seat.score === null) && (
        <p className="text-muted px-4 py-3 text-xs">
          Scores are unavailable in this older browser snapshot.
        </p>
      )}
    </Panel>
  );
}

function Share({ round }: { round: ArchivedRound }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const details = shareDetails(round);
  const fields = new URLSearchParams({
    title: details.title,
    line: details.line,
    round: String(round.round),
  });
  if (details.kind) fields.set("kind", details.kind);
  if (details.seat) fields.set("seat", details.seat);
  if (details.pnl !== undefined) fields.set("pnl", String(details.pnl));
  const imageUrl = `${origin}/api/og?${fields.toString()}`;
  const linkParams = new URLSearchParams(fields);
  linkParams.delete("round");
  if (round.fixture) linkParams.set("fixture", "1");
  const shareUrl = `${origin}/xray/${round.round}?${linkParams.toString()}`;
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(details.line)}&url=${encodeURIComponent(shareUrl)}`;
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOrigin(window.location.origin);
          setOpen(!open);
        }}
      >
        <Share2 className="size-3.5" /> Share
      </Button>
      {open && (
        <div className="border-line-strong bg-surface absolute right-0 z-10 mt-2 w-72 rounded-lg border p-4 shadow-xl">
          <p className="text-muted text-xs leading-5">{details.line}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(shareUrl)
                  .then(() => useToast.getState().add("Link copied."))
                  .catch(() => useToast.getState().add("Could not copy the link."))
              }
            >
              <Copy className="size-3" /> Copy link
            </Button>
            <a
              href={intent}
              target="_blank"
              rel="noreferrer"
              className="text-sealed flex items-center gap-1 px-2 text-xs"
            >
              Post on X <ArrowUpRight className="size-3" />
            </a>
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:text-text text-xs"
            >
              View share card
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function XrayView({ roundNumber }: { roundNumber?: number }) {
  const config = useInsider();
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  const selectedAuthority = params.get("authority");
  useFloor(config, fixture);
  const snapshot = useFloorStore((state) => state.snapshot);
  const status = useFloorStore((state) => state.status);
  const [round, setRound] = useState<ArchivedRound | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(180);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4 | 16>(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const previousReplay = useRef<{ round: string; tick: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const authority =
        selectedAuthority ?? (fixture ? undefined : config.tableAuthority?.toBase58());
      const matches =
        snapshot?.xray?.finalized === 1 &&
        (!authority || snapshot.table.authority.toBase58() === authority) &&
        (roundNumber === undefined || snapshot.xray.roundId === roundNumber);
      const direct = matches && snapshot ? createRoundObserver(fixture)(snapshot) : null;
      const saved = findRound(fixture, authority, roundNumber);
      if (!cancelled) {
        setRound(direct ?? saved);
        setLoaded(true);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [config.tableAuthority, fixture, roundNumber, selectedAuthority, snapshot]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setTick((value) => Math.min(CLOSING_END_TICK, value + 1)),
      500 / speed,
    );
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => {
    if (tick === CLOSING_END_TICK && playing) {
      const timer = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(timer);
    }
  }, [tick, playing]);
  useEffect(() => {
    if (!round) return;
    const key = `${round.authority}:${round.round}`;
    const previous = previousReplay.current;
    if (
      crossedSandwich(
        previous?.round === key ? previous.tick : -1,
        tick,
        round.xray.tags.flatMap((tag) => {
          const orders = sandwichOrders(tag, round.xray.orders);
          return orders ? [orders.exit.landTick] : [];
        }),
      )
    )
      playSound("sandwich");
    previousReplay.current = { round: key, tick };
  }, [round, tick]);
  const selected = useMemo(
    () => round?.xray.leaks.find((leak) => leak.header.leakId === selectedId),
    [round, selectedId],
  );
  if (!loaded && status === "loading") return <FloorSkeleton />;
  if (!round)
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center px-6 py-24">
        <span className="micro-label text-priority">After the bell</span>
        <h1 className="mt-3 text-3xl font-medium">
          {roundNumber ? `Round ${roundNumber} unavailable` : "No completed round yet"}
        </h1>
        <p className="text-muted mt-3 max-w-xl text-sm leading-6">
          {roundNumber
            ? "This round is no longer on chain and wasn't seen by this browser."
            : "The latest X-ray will appear after a round is finalized. Keep the floor open to save it on this browser."}
        </p>
        <Link href={fixture ? "/table?fixture=1" : "/table"} className="text-sealed mt-6 text-sm">
          ← Back to the floor
        </Link>
      </main>
    );
  const sold = round.xray.leaks.filter((leak) => leak.header.paid > 0).length;
  const opened = round.xray.leaks.filter((leak) => leak.header.openedTick > 0).length;
  const priority = round.xray.orders.length
    ? Math.round(
        (round.xray.orders.filter((order) => order.lane === 1).length * 100) /
          round.xray.orders.length,
      )
    : 0;
  const isVisible = (leak: (typeof round.xray.leaks)[number]) =>
    tick >= (leak.header.openedTick || CLOSING_END_TICK);
  const knownTags = round.xray.tags.filter((tag) => {
    const orders = sandwichOrders(tag, round.xray.orders);
    return orders && orders.exit.landTick <= tick;
  });
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-7">
      <Link
        href={fixture ? "/table?fixture=1" : "/table"}
        className="text-muted hover:text-text inline-flex items-center gap-2 font-mono text-[10px]"
      >
        <ArrowLeft className="size-3" /> THE FLOOR
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="micro-label text-priority">
            After the bell / public record{" "}
            {round.fixture && (
              <Badge tone="opened" className="ml-2">
                Fixture
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
            Round {String(round.round).padStart(2, "0")} <span className="text-muted">/</span> X-ray
          </h1>
          <p className="text-muted mt-2 text-xs">90 seconds of decisions, finally in the open.</p>
        </div>
        <div className="flex items-center gap-2">
          <Share round={round} />
          <Button
            onClick={() => {
              setTick(0);
              setPlaying(true);
            }}
          >
            <RotateCcw className="size-4" /> Replay round
          </Button>
        </div>
      </div>
      <div className="border-line bg-surface mt-6 grid grid-cols-2 divide-x rounded-lg border sm:grid-cols-4">
        {[
          [
            "Orders",
            `${round.xray.orderCount}${round.xray.droppedOrders ? ` (+${round.xray.droppedOrders} omitted)` : ""}`,
          ],
          ["Priority share", `${priority}%`],
          ["Leaks sold / opened", `${sold} / ${opened}`],
          ["Sandwiches", String(round.xray.tagCount)],
        ].map(([label, value]) => (
          <div key={label} className="p-4">
            <div className="micro-label">{label}</div>
            <div className="mt-2 font-mono text-xl">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          <Panel
            title="The whole tape"
            action={<span className="text-muted font-mono text-[10px]">T+{tick} / 180</span>}
          >
            <div className="h-[300px] px-3 pt-3 sm:h-[370px]">
              <ReplayChart
                round={round}
                tick={tick}
                selected={selected && isVisible(selected) ? selected : undefined}
              />
            </div>
            <div className="border-line flex flex-wrap items-center gap-3 border-t px-4 py-3">
              <button
                type="button"
                aria-label={playing ? "Pause replay" : "Play replay"}
                onClick={() => {
                  if (tick === 180) setTick(0);
                  setPlaying(!playing);
                }}
                className="text-sealed grid size-8 place-items-center rounded border border-current/30"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <input
                aria-label="Replay tick"
                type="range"
                min={0}
                max={180}
                value={tick}
                onChange={(event) => {
                  setPlaying(false);
                  setTick(Number(event.target.value));
                }}
                className="accent-sealed min-w-36 flex-1"
              />
              <div className="flex gap-1">
                {([1, 4, 16] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpeed(n)}
                    aria-pressed={speed === n}
                    className={`rounded px-2 py-1 font-mono text-[10px] ${speed === n ? "bg-sealed/15 text-sealed" : "text-muted"}`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              <span className="text-muted font-mono text-[10px]">{(tick / 2).toFixed(1)}s</span>
            </div>
          </Panel>
          <Panel title="Leak timeline" label="Minted → window" className="mt-3">
            <div className="relative mx-4 h-[96px] overflow-hidden">
              <div className="bg-line absolute top-12 right-0 left-0 h-px" />
              {round.xray.leaks
                .filter((leak) => leak.header.mintedTick <= tick)
                .map((leak) => (
                  <div
                    key={`window-${leak.header.leakId}`}
                    aria-hidden
                    className={
                      leak.header.rarity === 2
                        ? "bg-epic/40"
                        : leak.header.rarity === 1
                          ? "bg-rare/40"
                          : "bg-common/40"
                    }
                    style={{
                      position: "absolute",
                      top: 46,
                      height: 4,
                      left: `${(leak.header.mintedTick / 180) * 100}%`,
                      width: `${(Math.max(0, Math.min(tick, leak.header.windowEnd) - leak.header.mintedTick) / 180) * 100}%`,
                    }}
                  />
                ))}
              {round.xray.leaks
                .filter((leak) => leak.header.mintedTick <= tick)
                .map((leak, index) => {
                  const h = leak.header;
                  return (
                    <button
                      key={h.leakId}
                      type="button"
                      onClick={() => setSelectedId(h.leakId)}
                      aria-pressed={selectedId === h.leakId}
                      title={
                        isVisible(leak)
                          ? `${traceName(round, h.ownerSeat)} · paid ${h.paid} · ${h.flips} flips · opened ${h.openedTick ? `T+${h.openedTick}` : "never"}`
                          : "Sealed at this point"
                      }
                      className={`absolute max-w-[112px] -translate-x-1/2 truncate rounded border px-2 py-1 font-mono text-[9px] ${h.rarity === 2 ? "border-epic/40 text-epic" : h.rarity === 1 ? "border-rare/40 text-rare" : "border-common/40 text-common"} ${selectedId === h.leakId ? "bg-surface-2" : "bg-bg"}`}
                      style={{
                        left: `${Math.max(7, Math.min(93, (h.mintedTick / 180) * 100))}%`,
                        top: index % 2 ? 54 : 15,
                      }}
                    >
                      {LEAK_KINDS[h.kind] ?? "Leak"} #{h.leakId}
                    </button>
                  );
                })}
            </div>
          </Panel>
          {tick === 180 && <Scoreboard round={round} />}
        </div>
        <aside className="space-y-3">
          <Panel title="Leak detail" label={selected ? `#${selected.header.leakId}` : undefined}>
            {selected ? (
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{LEAK_KINDS[selected.header.kind] ?? "Leak"}</h2>
                  <Badge
                    tone={
                      selected.header.rarity === 2
                        ? "epic"
                        : selected.header.rarity === 1
                          ? "rare"
                          : "common"
                    }
                  >
                    {RARITIES[selected.header.rarity] ?? "Unknown"}
                  </Badge>
                </div>
                <p className="text-muted mt-2 font-mono text-[10px]">
                  MINTED T+{selected.header.mintedTick} · WINDOW T+{selected.header.windowStart}–
                  {selected.header.windowEnd}
                </p>
                {isVisible(selected) ? (
                  <>
                    <div className="border-line mt-4 space-y-2 border-t pt-3 font-mono text-[11px] leading-5">
                      {publicPayload(round, selected).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <p className="text-muted mt-4 text-[11px]">
                      Holder: {traceName(round, selected.header.ownerSeat)} · paid{" "}
                      {selected.header.paid} · {selected.header.flips} flips · opened{" "}
                      {selected.header.openedTick ? `T+${selected.header.openedTick}` : "never"}
                    </p>
                  </>
                ) : (
                  <p className="text-muted mt-4 text-xs">
                    The payload was still sealed at this point in the replay.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted p-4 text-xs">
                Select a Leak on the timeline to reveal its payload and highlight captured orders.
              </p>
            )}
          </Panel>
          <Panel title="Sandwiches" action={<Badge tone="opened">{round.xray.tagCount}</Badge>}>
            {knownTags.length ? (
              knownTags.map((tag, i) => (
                <div key={i} className="border-line border-b px-4 py-3 last:border-0">
                  <div className="text-xs">
                    {traceName(round, tag.front)} <span className="text-muted">→</span>{" "}
                    {traceName(round, tag.victim)}
                  </div>
                  <div className="text-opened mt-1 font-mono text-[10px]">
                    {tag.profitEstimate > 0 ? "+" : ""}
                    {tag.profitEstimate} chips · T+{tag.victimTick}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted p-4 text-xs">No tagged sandwiches at this point.</p>
            )}
          </Panel>
          <div className="text-muted px-1 text-[11px] leading-5">
            Orders are shown when sent; their side, size and fill price appear only after landing.
            Whale orders appear at landing.
          </div>
        </aside>
      </div>
    </main>
  );
}
