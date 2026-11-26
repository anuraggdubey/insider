"use client";

import type { InsiderConfig, TableView } from "@insider/sdk";
import { TICK_MILLIS } from "@insider/sdk/constants";
import { Check, CircleHelp } from "lucide-react";
import Link from "next/link";
import { useJoin } from "@/components/onboarding/guest";
import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { updateFloor } from "@/lib/floor-store";

/** Scrolls a floor panel into view and flashes it, so "where do I click?" has an answer. */
export function spotlight(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.remove("spot-flash");
  void node.offsetWidth;
  node.classList.add("spot-flash");
  node.querySelector<HTMLElement>("[data-spot-focus]")?.focus({ preventScroll: true });
}

const steps = [
  { label: "Take a seat", target: "join-seat" },
  { label: "Buy or Sell", target: "action-pad" },
  { label: "Grab a capsule", target: "capsule-tray" },
  { label: "See the X-ray", target: null },
] as const;

/**
 * The "what do I do now?" bar: where you are in a round, one sentence on the next move and a button
 * that does it. It only reads the table view; it never changes the round on its own.
 */
export function FloorCoach({
  config,
  view,
  xrayHref,
  onShowTrade,
}: {
  config: InsiderConfig;
  view: TableView;
  xrayHref: string;
  /** Switches the mobile layout to the panel a step points at. */
  onShowTrade?: (tab: "Trade" | "Capsules") => void;
}) {
  const { busy, joinAsGuest } = useJoin(config);
  const seated = Boolean(view.mine);
  const holdsLeak = view.leaks.some((leak) => leak.isMine && leak.state !== 0);
  const current = view.phase === "xray" ? 3 : !seated ? 0 : holdsLeak ? 2 : 1;
  const landing = view.myPending.length
    ? Math.min(...view.myPending.map((order) => order.ticksToLand))
    : null;
  const between = view.phase === "idle" || view.phase === "seeding";

  let hint: string;
  let action: { label: string; run: () => void } | null = null;
  const show = (target: string, tab?: "Trade" | "Capsules") => {
    if (tab) onShowTrade?.(tab);
    setTimeout(() => spotlight(target), 0);
  };
  if (view.phase === "xray") hint = "Round over. Every hidden move is now revealed.";
  else if (!seated) {
    hint = between
      ? "The next round starts soon. Sit down now to play it."
      : "You're watching a live round. Sit down to play: it's free.";
    action = { label: "Take a free seat", run: () => void joinAsGuest() };
  } else if (between) hint = "You're seated. The next round starts in a few seconds.";
  else if (view.mine?.liquidated)
    hint = "You ran out of chips this round. You're back in next round.";
  else if (view.phase === "closing") hint = "Orders are closed. The last ones are landing now.";
  else if (landing !== null)
    hint = `Order sent. It's hidden, and lands in ${((landing * TICK_MILLIS) / 1000).toFixed(1)}s.`;
  else if (holdsLeak) {
    hint = "You won a capsule. Open it to read the secret, then trade ahead of it.";
    action = { label: "Show my capsule", run: () => show("capsule-tray", "Capsules") };
  } else {
    hint = "Your move: pick Buy (price up) or Sell (price down), then Send.";
    action = { label: "Go to Buy / Sell", run: () => show("action-pad", "Trade") };
  }

  return (
    <section
      aria-label="Your next move"
      data-testid="floor-coach"
      className="floor-coach border-line bg-surface mb-3 flex shrink-0 flex-col gap-2.5 rounded-xl border px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4"
    >
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="Round steps">
        {steps.map((step, index) => {
          const state = index === current ? "current" : index < current ? "done" : "next";
          const content = (
            <>
              <span className="bg-surface text-ink grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold">
                {state === "done" ? <Check aria-hidden className="size-3" /> : index + 1}
              </span>
              {step.label}
            </>
          );
          const className = cn(
            "coach-step border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink items-center gap-1.5 rounded-full border-2 py-1 pr-3 pl-1.5 font-[family-name:var(--font-display)] text-[13px] font-semibold",
            state === "current" ? "flex" : "hidden sm:flex",
          );
          return (
            <li key={step.label} data-state={state}>
              {step.target ? (
                <button
                  type="button"
                  aria-current={state === "current" ? "step" : undefined}
                  className={className}
                  onClick={() =>
                    show(
                      step.target,
                      step.target === "capsule-tray"
                        ? "Capsules"
                        : step.target === "action-pad"
                          ? "Trade"
                          : undefined,
                    )
                  }
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={xrayHref}
                  prefetch={false}
                  aria-current={state === "current" ? "step" : undefined}
                  className={className}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end">
        <p className="text-ink min-w-0 text-sm font-bold">{hint}</p>
        {action && (
          <Button
            size="sm"
            className={cn(!seated && "coach-pulse")}
            loading={!seated && busy}
            onClick={action.run}
          >
            {action.label}
          </Button>
        )}
        {view.phase === "xray" && (
          <Link
            href={xrayHref}
            prefetch={false}
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            Open the X-ray
          </Link>
        )}
        <button
          type="button"
          onClick={() => updateFloor({ guide: true })}
          className="text-brand flex items-center gap-1 text-xs font-extrabold underline-offset-4 hover:underline"
        >
          <CircleHelp aria-hidden className="size-3.5" /> How to play
        </button>
      </div>
    </section>
  );
}
