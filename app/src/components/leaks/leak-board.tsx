"use client";

import { Eye, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { useState } from "react";
import type { InsiderConfig, LeakVaultAccount, TableSnapshot, TableView } from "@insider/sdk";
import type { PublicKey } from "@solana/web3.js";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Num } from "@/components/ui/num";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { actOnLeak, type LeakAction } from "@/lib/floor-actions";
import { cn } from "@/lib/cn";
import { friendlyError } from "@/lib/errors";
import { leakEdge } from "@/lib/leak-edge";
import { leakHint } from "./hints";
import { CrackOpen } from "./crack-open";
import { payloadLines } from "./payload";

type Leak = TableView["leaks"][number];

function LeakCard({
  leak,
  view,
  vault,
  run,
  snapshot,
}: {
  leak: Leak;
  view: TableView;
  vault?: LeakVaultAccount;
  run: (action: LeakAction, leak: Leak, ask?: number) => Promise<void>;
  snapshot: TableSnapshot;
}) {
  const [editing, setEditing] = useState<"list" | "offer" | null>(null);
  const [ask, setAsk] = useState(50);
  const [busy, setBusy] = useState(false);
  const perform = async (action: LeakAction, amount?: number) => {
    setBusy(true);
    try {
      await run(action, leak, amount);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };
  if (leak.state === 0)
    return (
      <div className="border-line/70 bg-bg/50 flex min-h-[180px] flex-col justify-between rounded-md border border-dashed p-3">
        <span className="text-faint font-mono text-[9px]">
          SLOT {String(leak.slot + 1).padStart(2, "0")}
        </span>
        <span className="text-faint font-mono text-[9px]">AWAITING DROP</span>
      </div>
    );
  const rarity = leak.rarityName.toLowerCase() as BadgeTone;
  const isOpened = leak.state === 4;
  const windowExpired = view.tick > leak.windowEnd;
  const canBid = leak.canBid && !windowExpired;
  const unopened = view.leaks.filter(
    (item) => item.isMine && (item.state === 2 || item.state === 3),
  ).length;
  const reason = windowExpired
    ? "Leak window expired"
    : leak.ticksLeft <= 0
      ? "Auction ended"
      : !view.mine
        ? "Claim a seat to buy"
        : unopened >= 2
          ? "Unopened leak limit reached"
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
      className={cn(
        "sealed-card relative flex min-h-[180px] flex-col overflow-hidden rounded-md border p-3",
        isOpened && leak.isReader
          ? "border-opened/30 bg-opened/5"
          : "border-line-strong bg-surface-2/60",
        `rarity-${rarity}`,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-faint font-mono text-[9px]">
          #{String(leak.leakId).padStart(3, "0")}
        </span>
        <Badge tone={rarity} className="px-1 py-0.5 text-[8px]">
          {leak.rarityName}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {isOpened && leak.isReader ? (
          <UnlockKeyhole className="text-opened size-3" />
        ) : (
          <LockKeyhole className="text-sealed size-3" />
        )}
        <h3 className="truncate text-xs font-medium">{leak.kindName}</h3>
      </div>
      <div className="mt-1 flex items-center">
        <Badge
          tone={leak.family === "Flow" ? "flow" : "fundamentals"}
          className="px-1 py-0.5 text-[8px]"
        >
          {leak.family}
        </Badge>
      </div>
      <div className="text-faint mt-1 font-mono text-[8px]">{leakHint(leak, view.tick)}</div>
      <div className="mt-2 min-h-[38px]">
        {leak.state === 5 ? (
          <div className="text-faint font-mono text-[9px]">
            {windowExpired ? "WINDOW EXPIRED" : "AUCTION ENDED"}
          </div>
        ) : leak.state === 1 ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-faint font-mono text-[9px]">DUTCH PRICE</span>
              <span className="text-text text-xs">
                <Num value={leak.currentPrice} />{" "}
                <span className="text-faint text-[9px]">CHIPS</span>
              </span>
            </div>
            <div className="bg-line mt-2 h-0.5 rounded-full">
              <div
                className="bg-sealed h-full"
                style={{ width: `${(leak.ticksLeft / 12) * 100}%` }}
              />
            </div>
          </>
        ) : leak.state === 2 && leak.isMine ? (
          <div className="text-sealed font-mono text-[9px]">SEALED · NEVER READ</div>
        ) : leak.state === 3 ? (
          <div className="text-muted font-mono text-[9px]">
            {leak.isMine ? "YOUR LISTING" : `LISTED BY ${owner.toUpperCase()}`}
            <br />
            <span className="text-text">{leak.ask} CHIPS</span>
          </div>
        ) : leak.state === 4 && leak.isReader ? (
          <div className="text-opened line-clamp-2 font-mono text-[9px] leading-4">
            {vault ? payloadLines(vault, view).join(" · ") : "Decrypting private vault…"}
          </div>
        ) : (
          <div className="text-muted font-mono text-[9px]">
            {isOpened ? `OPENED BY ${owner.toUpperCase()}` : `HELD BY ${owner.toUpperCase()}`}
          </div>
        )}
      </div>
      {edge && (
        <div className="mt-2" aria-label="Edge left">
          <div className="text-muted flex justify-between gap-1 font-mono text-[9px]">
            <span>{leak.readerCount}/4 READERS</span>
            <span>{edge.ticksLeft} TICKS LEFT</span>
          </div>
          <div className="bg-line mt-1 h-1 rounded-full">
            <div
              className="bg-opened h-full"
              style={{
                width: `${Math.min(100, (edge.ticksLeft / Math.max(1, leak.windowEnd - leak.mintedTick)) * 100)}%`,
              }}
            />
          </div>
          <div className="text-muted mt-1 font-mono text-[9px]">
            {edge.impactBps === null
              ? "NO PENDING ORDER IMPACT"
              : `IF PENDING: ${(edge.impactBps / 100).toFixed(2)}% IMPACT`}
          </div>
        </div>
      )}
      {isOpened && readers.length > 0 && (
        <div className="text-muted mt-1 text-[9px]" title={readers.join(", ")}>
          Readers: {readers.join(", ")}
        </div>
      )}
      <div className="mt-auto pt-2">
        {editing && leak.state !== 5 ? (
          <div className="flex gap-1">
            <input
              aria-label={`${editing === "list" ? "Flip" : "License"} ask in chips`}
              type="number"
              min={0}
              value={ask}
              onChange={(event) => setAsk(Math.max(0, Math.floor(Number(event.target.value))))}
              className="border-line-strong bg-bg w-14 rounded border px-1.5 font-mono text-[10px] outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[10px]"
              loading={busy}
              disabled={editing === "list" && ask === 0}
              onClick={() => void perform(editing, ask)}
            >
              Set
            </Button>
            <button type="button" className="text-faint px-1" onClick={() => setEditing(null)}>
              ×
            </button>
          </div>
        ) : leak.state === 1 ? (
          <div>
            <Button
              size="sm"
              className="h-7 w-full text-[10px]"
              disabled={!canBid}
              title={!canBid ? reason : "Buy sealed leak"}
              loading={busy}
              onClick={() => void perform("bid")}
            >
              Buy for {leak.currentPrice}
            </Button>
            {!canBid && <div className="text-faint mt-1 text-center text-[9px]">{reason}</div>}
          </div>
        ) : leak.state === 2 && leak.isMine ? (
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={!leak.canOpen}
              loading={busy}
              onClick={() => void perform("open")}
            >
              <Eye className="size-3" /> Open
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              disabled={!leak.canList}
              onClick={() => setEditing("list")}
            >
              Flip
            </Button>
          </div>
        ) : leak.state === 3 && leak.isMine ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-[10px]"
            loading={busy}
            onClick={() => void perform("list", 0)}
          >
            Cancel listing
          </Button>
        ) : leak.state === 3 ? (
          <Button
            size="sm"
            className="h-7 w-full text-[10px]"
            disabled={!leak.canBuy}
            loading={busy}
            onClick={() => void perform("buy")}
          >
            Buy for {leak.ask}
          </Button>
        ) : leak.state === 4 && leak.isMine ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-[10px]"
            onClick={() => setEditing("offer")}
          >
            License · {leak.readerCount}/4 readers
          </Button>
        ) : leak.state === 4 && !leak.isReader && leak.licenseAsk > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-[10px]"
            disabled={!leak.canLicense}
            loading={busy}
            onClick={() => void perform("license")}
          >
            License for {leak.licenseAsk}
          </Button>
        ) : (
          <span className="text-faint font-mono text-[9px]">
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
  const [crack, setCrack] = useState<{ title: string; lines: string[] } | null>(null);
  const run = async (action: LeakAction, leak: Leak, ask?: number) => {
    try {
      const vault = await actOnLeak(config, action, leak.slot, ask);
      if (vault) setCrack({ title: leak.kindName, lines: payloadLines(vault, view) });
    } catch (error) {
      useToast.getState().add(friendlyError(error));
    }
  };
  return (
    <>
      <Panel
        title="Leak board"
        action={<span className="micro-label">Private until opened · 6 slots</span>}
      >
        <div className="leak-grid grid grid-cols-2 gap-2 p-3 md:grid-cols-3 xl:grid-cols-6">
          {view.leaks.map((leak) => (
            <LeakCard
              key={`${leak.slot}-${leak.leakId}`}
              leak={leak}
              view={view}
              vault={vaults[leak.leakId]}
              run={run}
              snapshot={snapshot}
            />
          ))}
        </div>
      </Panel>
      {crack && <CrackOpen title={crack.title} lines={crack.lines} close={() => setCrack(null)} />}
    </>
  );
}
