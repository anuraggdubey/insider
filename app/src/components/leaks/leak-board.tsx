"use client";

import { Eye, LockKeyhole, UnlockKeyhole } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { InsiderConfig, LeakVaultAccount, TableSnapshot, TableView } from "@insider/sdk";
import type { PublicKey } from "@solana/web3.js";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Capsule, type CapsuleRarity, type CapsuleState } from "@/components/ui/capsule";
import { FlipBoard } from "@/components/ui/flip-board";
import { Panel } from "@/components/ui/panel";
import { Stamp } from "@/components/ui/stamp";
import { useToast } from "@/components/ui/toast";
import type { LeakAction } from "@/lib/floor-actions";
import { cn } from "@/lib/cn";
import { friendlyError } from "@/lib/errors";
import { leakEdge } from "@/lib/leak-edge";
import { leakPlain, seatAvailable, seconds } from "@/lib/onboarding";
import { nextLeakDrop } from "@/lib/next-leak-drop";
import { playSound } from "@/lib/sound";
import { leakHint } from "./hints";
import { payloadLines } from "./payload";

type Leak = TableView["leaks"][number];
const CrackOpen = dynamic(() => import("./crack-open").then((module) => module.CrackOpen), {
  ssr: false,
});

function LeakCard({
  leak,
  view,
  vault,
  run,
  snapshot,
  nextDrop,
}: {
  leak: Leak;
  view: TableView;
  vault?: LeakVaultAccount;
  run: (action: LeakAction, leak: Leak, ask?: number) => Promise<boolean>;
  snapshot: TableSnapshot;
  nextDrop?: string;
}) {
  const [editing, setEditing] = useState<"list" | "offer" | null>(null);
  const [ask, setAsk] = useState(50);
  const [busy, setBusy] = useState(false);
  const [popped, setPopped] = useState(false);
  const perform = async (action: LeakAction, amount?: number) => {
    setBusy(true);
    try {
      const ok = await run(action, leak, amount);
      if (ok) {
        setEditing(null);
        if (action === "bid" || action === "buy") {
          setPopped(true);
          setTimeout(() => setPopped(false), 1400);
        }
      }
    } finally {
      setBusy(false);
    }
  };
  if (leak.state === 0)
    return (
      <div className="border-line-strong bg-surface-2/60 flex min-h-20 w-full items-center gap-3 self-start rounded-2xl border-2 border-dashed p-3">
        <span
          aria-hidden
          className="border-line-strong size-11 shrink-0 rounded-full border-2 border-dashed"
        />
        <span className="text-faint font-mono text-xs font-bold">
          SLOT {String(leak.slot + 1).padStart(2, "0")}
          {nextDrop ? (
            <span className="text-opened mt-1 block text-[11px]">NEXT DROP IN {nextDrop}</span>
          ) : (
            <span className="mt-1 block font-[family-name:var(--font-body)]">
              Waiting for a drop
            </span>
          )}
        </span>
      </div>
    );
  const rarity = leak.rarityName.toLowerCase() as BadgeTone;
  const capsuleRarity: CapsuleRarity = rarity === "rare" || rarity === "epic" ? rarity : "common";
  const capsuleState: CapsuleState =
    leak.state === 1
      ? "sealed"
      : leak.state === 2
        ? "owned"
        : leak.state === 3
          ? "listed"
          : leak.state === 4
            ? "opened"
            : "expired";
  const isOpened = leak.state === 4;
  const windowExpired = view.tick > leak.windowEnd;
  const canBid = leak.canBid && !windowExpired;
  const unopened = view.leaks.filter(
    (item) => item.isMine && (item.state === 2 || item.state === 3),
  ).length;
  const reason = windowExpired
    ? "This clue has expired"
    : leak.ticksLeft <= 0
      ? "Nobody bought it in time"
      : !view.mine
        ? seatAvailable(snapshot)
          ? "Join the game to buy"
          : "Watching only: every seat is busy"
        : unopened >= 2
          ? "Open one of yours first (2 sealed max)"
          : view.mine.chips < leak.currentPrice
            ? "Not enough chips"
            : "Unavailable";
  const owner = view.seats.find((seat) => seat.index === leak.ownerSeat)?.name ?? "Another seat";
  const edge =
    vault && isOpened && leak.isReader
      ? leakEdge(vault, view.tick, leak.windowEnd, snapshot.market, snapshot.table.params.feeBps)
      : null;
  const readers = leak.readers
    .slice(0, leak.readerCount)
    .map(
      (key: PublicKey) =>
        view.seats.find((seat) => seat.owner.equals(key))?.name ??
        `${key.toBase58().slice(0, 4)}…${key.toBase58().slice(-4)}`,
    );
  return (
    <article
      tabIndex={-1}
      aria-label={`${leak.kindName} Leak`}
      className={cn(
        "sealed-card relative flex min-h-[180px] flex-col overflow-hidden rounded-2xl border-2 p-3",
        isOpened && leak.isReader
          ? "border-opened/30 bg-opened/5"
          : "border-line-strong bg-surface-2/60",
        `rarity-${rarity}`,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-faint font-mono text-[11px]">
          #{String(leak.leakId).padStart(3, "0")}
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          {leak.isMine && (
            <Badge tone="opened" className="px-1 py-0.5 text-[10px]">
              Yours
            </Badge>
          )}
          <Badge tone={rarity} className="px-1 py-0.5 text-[10px]">
            {leak.rarityName}
          </Badge>
        </div>
      </div>
      {nextDrop && (
        <span className="text-opened mt-2 font-mono text-[11px]">NEXT DROP IN {nextDrop}</span>
      )}
      <div className="relative mx-auto mt-2 grid size-20 place-items-center">
        {leak.state === 1 && (
          <svg
            viewBox="0 0 80 80"
            className="absolute inset-0 size-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="40"
              cy="40"
              r="37"
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth="2"
            />
            <circle
              cx="40"
              cy="40"
              r="37"
              fill="none"
              stroke="var(--color-sealed)"
              strokeWidth="2"
              strokeDasharray={`${Math.max(0, Math.min(1, leak.ticksLeft / 12)) * 232.5} 232.5`}
            />
          </svg>
        )}
        <Capsule
          rarity={capsuleRarity}
          state={capsuleState}
          size={72}
          mine={leak.isMine}
          motion={
            popped ? "pop" : leak.state === 1 && view.tick - leak.mintedTick <= 1 ? "drop" : "none"
          }
        />
        {popped && (
          <Stamp className="text-buy absolute -right-2 -bottom-1 text-[10px]">Bought</Stamp>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {isOpened && leak.isReader ? (
          <UnlockKeyhole className="text-opened size-3" />
        ) : (
          <LockKeyhole className="text-sealed size-3" />
        )}
        <h3 className="truncate text-base font-semibold">{leak.kindName}</h3>
      </div>
      <div className="mt-1 flex items-center">
        <Badge
          tone={leak.family === "Flow" ? "flow" : "fundamentals"}
          className="px-1 py-0.5 text-[10px]"
        >
          {leak.family}
        </Badge>
      </div>
      <p className="leak-tells text-ink mt-1.5 text-[11px] leading-4 font-semibold">
        <span className="text-muted font-extrabold">Tells you: </span>
        {leakPlain(leak.kind)}
      </p>
      <div className="text-faint mt-1 font-mono text-[10px]">{leakHint(leak, view.tick)}</div>
      <div className="mt-2 min-h-[38px]">
        {leak.state === 5 ? (
          <div className="text-faint font-mono text-[11px]">
            {windowExpired ? "CLUE EXPIRED" : "NOBODY BOUGHT IT"}
          </div>
        ) : leak.state === 1 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted text-[11px] leading-4 font-extrabold">
                Price now
                <br />
                <span className="text-faint">chips</span>
              </span>
              <FlipBoard flipKey={leak.currentPrice} className="text-2xl">
                {leak.currentPrice.toLocaleString("en-US")}
              </FlipBoard>
            </div>
            <div className="bg-line mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${(leak.ticksLeft / 12) * 100}%` }}
              />
            </div>
          </>
        ) : leak.state === 2 && leak.isMine ? (
          <div className="text-sealed font-mono text-[11px]">SEALED · NEVER READ</div>
        ) : leak.state === 3 ? (
          <div className="text-muted font-mono text-[11px]">
            {leak.isMine ? "YOUR LISTING" : `LISTED BY ${owner.toUpperCase()}`}
            <br />
            <span className="text-text">{leak.ask} CHIPS</span>
          </div>
        ) : leak.state === 4 && leak.isReader ? (
          <div className="text-opened line-clamp-2 font-mono text-[11px] leading-4">
            {vault ? payloadLines(vault, view).join(" · ") : "Decrypting private vault…"}
          </div>
        ) : (
          <div className="text-muted font-mono text-[11px]">
            {!isOpened && (
              <FlipBoard flipKey="sold" sold className="mb-1 text-sm">
                SOLD
              </FlipBoard>
            )}
            <span className="block">
              {isOpened ? `OPENED BY ${owner.toUpperCase()}` : `HELD BY ${owner.toUpperCase()}`}
            </span>
          </div>
        )}
      </div>
      {edge && (
        <div className="mt-2" aria-label="Edge left">
          <div className="text-muted flex justify-between gap-1 font-mono text-[11px]">
            <span>{leak.readerCount}/4 READERS</span>
            <span>{seconds(edge.ticksLeft)} LEFT</span>
          </div>
          <div className="bg-line mt-1 h-1 rounded-full">
            <div
              className="bg-opened h-full"
              style={{
                width: `${Math.min(100, (edge.ticksLeft / Math.max(1, leak.windowEnd - leak.mintedTick)) * 100)}%`,
              }}
            />
          </div>
          <div className="text-muted mt-1 font-mono text-[11px]">
            {edge.impactBps === null
              ? "NO WAITING ORDER INSIDE"
              : `BIGGEST ORDER IN IT: ${(edge.impactBps / 100).toFixed(2)}% PRICE MOVE`}
          </div>
        </div>
      )}
      {isOpened && readers.length > 0 && (
        <div className="text-muted mt-1 text-[11px]" title={readers.join(", ")}>
          Readers: {readers.join(", ")}
        </div>
      )}
      <div className="mt-auto pt-2">
        {editing && leak.state !== 5 ? (
          <div className="flex gap-1">
            <input
              aria-label={
                editing === "list" ? "Resale price in chips" : "Price per reader in chips"
              }
              type="number"
              min={0}
              value={ask}
              onChange={(event) => setAsk(Math.max(0, Math.floor(Number(event.target.value))))}
              className="border-line-strong bg-bg w-14 rounded border px-1.5 font-mono text-xs outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1 text-xs"
              loading={busy}
              disabled={editing === "list" && ask === 0}
              onClick={() => void perform(editing, ask)}
            >
              {editing === "list" ? "Put up for sale" : "Set price"}
            </Button>
            <button
              type="button"
              aria-label="Cancel editing"
              className="text-faint px-1"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
          </div>
        ) : leak.state === 1 ? (
          <div>
            <Button
              size="sm"
              className="h-9 w-full text-xs"
              disabled={!canBid}
              title={!canBid ? reason : "Buy this secret, still sealed"}
              aria-label={`Buy for ${leak.currentPrice} chips: ${leak.kindName} capsule`}
              loading={busy}
              onClick={() => void perform("bid")}
            >
              Buy for {leak.currentPrice} chips
            </Button>
            {!canBid && <div className="text-faint mt-1 text-center text-[11px]">{reason}</div>}
          </div>
        ) : leak.state === 2 && leak.isMine ? (
          <div>
            <div className="grid grid-cols-2 gap-1">
              <Button
                size="sm"
                className="h-9 text-xs"
                disabled={!leak.canOpen}
                loading={busy}
                onClick={() => void perform("open")}
              >
                <Eye className="size-3" /> Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                disabled={!leak.canList}
                onClick={() => setEditing("list")}
              >
                Resell
              </Button>
            </div>
            <p className="text-faint mt-1 text-center text-[10px] leading-3.5 font-semibold">
              Open: read it. Resell: sell it unread.
            </p>
          </div>
        ) : leak.state === 3 && leak.isMine ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full text-xs"
            loading={busy}
            onClick={() => void perform("list", 0)}
          >
            Cancel listing
          </Button>
        ) : leak.state === 3 ? (
          <Button
            size="sm"
            className="h-9 w-full text-xs"
            disabled={!leak.canBuy}
            loading={busy}
            onClick={() => void perform("buy")}
          >
            Buy for {leak.ask} chips
          </Button>
        ) : leak.state === 4 && leak.isMine ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full text-xs"
            onClick={() => setEditing("offer")}
          >
            Sell access · {leak.readerCount}/4
          </Button>
        ) : leak.state === 4 && !leak.isReader && leak.licenseAsk > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full text-xs"
            disabled={!leak.canLicense}
            loading={busy}
            onClick={() => void perform("license")}
          >
            Read for {leak.licenseAsk} chips
          </Button>
        ) : (
          <span className="text-muted font-mono text-[11px] font-bold">
            {isOpened ? `${leak.readerCount}/4 READERS` : "NOT FOR SALE"}
          </span>
        )}
      </div>
    </article>
  );
}

export function LeakBoard({
  config,
  view,
  vaults,
  snapshot,
}: {
  config: InsiderConfig;
  view: TableView;
  vaults: Record<number, LeakVaultAccount>;
  snapshot: TableSnapshot;
}) {
  const [crack, setCrack] = useState<{
    kind: number;
    title: string;
    lines: string[];
    returnFocus: HTMLElement | null;
    rarity: CapsuleRarity;
  } | null>(null);
  const nextDrop = nextLeakDrop(snapshot.board, view.round, view.tick, view.phase);
  const run = async (action: LeakAction, leak: Leak, ask?: number) => {
    const returnFocus = document.activeElement?.closest("article") ?? null;
    try {
      const { actOnLeak } = await import("@/lib/floor-actions");
      const vault = await actOnLeak(config, action, leak.slot, ask);
      if (vault) {
        playSound("crack");
        const rarity = leak.rarityName.toLowerCase();
        setCrack({
          kind: leak.kind,
          title: leak.kindName,
          lines: payloadLines(vault, view),
          returnFocus,
          rarity: rarity === "rare" || rarity === "epic" ? rarity : "common",
        });
      }
      return true;
    } catch (error) {
      useToast.getState().add(friendlyError(error));
      return false;
    }
  };
  return (
    <>
      <Panel
        title="Secret capsules"
        action={
          <span className="micro-label hidden text-right sm:inline">
            Private clues about this round
          </span>
        }
      >
        <ol className="leak-steps border-line text-muted flex flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2 text-xs font-bold">
          <li>
            <strong className="text-ink">1. Buy</strong> while the price falls
          </li>
          <li>
            <strong className="text-ink">2. Open</strong> to read it privately
          </li>
          <li>
            <strong className="text-ink">3. Trade</strong> before everyone else finds out
          </li>
        </ol>
        <div className="leak-grid grid grid-cols-2 gap-2 p-3 md:grid-cols-3 xl:grid-cols-6">
          {view.leaks.map((leak) => (
            <LeakCard
              key={`${leak.slot}-${leak.leakId}`}
              leak={leak}
              view={view}
              vault={vaults[leak.leakId]}
              run={run}
              snapshot={snapshot}
              nextDrop={nextDrop && nextDrop.slot === leak.slot ? nextDrop.time : undefined}
            />
          ))}
        </div>
      </Panel>
      {crack && (
        <CrackOpen
          kind={crack.kind}
          tick={view.tick}
          title={crack.title}
          lines={crack.lines}
          rarity={crack.rarity}
          returnFocus={crack.returnFocus}
          close={() => setCrack(null)}
        />
      )}
    </>
  );
}
