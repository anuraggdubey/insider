"use client";

import type { InsiderConfig, TableView } from "@insider/sdk";
import { Eye, Gift, ScanSearch, TrendingUp, UserRoundPlus, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WalletPlayButton } from "@/components/onboarding/wallet";
import { useJoin } from "@/components/onboarding/guest";
import { useDialogFocus } from "@/lib/dialog-focus";
import { updateFloor, useFloorStore } from "@/lib/floor-store";

const SEEN_KEY = "insider.guide.seen.v1";

const steps = [
  {
    icon: UserRoundPlus,
    title: "Take a free seat",
    text: "You get 1,000 play chips. No wallet, no sign-up, nothing real at stake.",
  },
  {
    icon: TrendingUp,
    title: "Call the price",
    text: "Buy if you think the price goes up, Sell if you think it goes down. Your order stays hidden for a few seconds, then lands at the price of that moment.",
  },
  {
    icon: Gift,
    title: "Play the secrets",
    text: "Capsules leak what other players are about to do. Win one, open it, and trade before their order lands. That is front-running, and here it is the game.",
  },
  {
    icon: ScanSearch,
    title: "See the X-ray",
    text: "A round lasts about 100 seconds. Then every hidden move is revealed and ranked. Most chips wins.",
  },
] as const;

/** Opens the guide once on a visitor's first visit to the floor. */
export function useFirstVisitGuide() {
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) updateFloor({ guide: true });
    } catch {}
  }, []);
}

/** The plain-language "how this game works" dialog, with the way in at the bottom. */
export function HowToPlay({ config, view }: { config: InsiderConfig; view: TableView }) {
  const open = useFloorStore((state) => state.guide);
  const { busy, joinAsGuest, joinFloor } = useJoin(config);
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    updateFloor({ guide: false });
  };
  const dialog = useDialogFocus(open, close);
  if (!open) return null;
  const seated = Boolean(view.mine);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      ref={dialog}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="border-line-strong bg-surface relative w-full max-w-lg rounded-2xl border-2 p-6 sm:p-8">
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="text-muted hover:text-ink absolute top-4 right-4"
        >
          <X className="size-5" />
        </button>
        <span className="micro-label text-brand">How to play</span>
        <h2
          id="how-to-play-title"
          className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-tight font-bold sm:text-3xl"
        >
          Trade on secrets. Fastest read wins.
        </h2>
        <p className="text-muted mt-2 text-sm leading-6">
          INSIDER is a 100-second trading game with play money. Everyone&apos;s orders are hidden
          for a moment before they land, and the edge is finding out what the others are about to
          do.
        </p>
        <ol className="mt-6 space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-full text-white">
                <step.icon aria-hidden className="size-4" />
              </span>
              <div>
                <div className="text-sm font-extrabold">
                  <span className="text-muted mr-1.5 font-mono text-xs">{index + 1}</span>
                  {step.title}
                </div>
                <p className="text-muted mt-0.5 text-[13px] leading-5">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-line mt-7 border-t pt-5">
          {seated ? (
            <Button className="w-full" size="lg" onClick={close}>
              Got it, let me trade
            </Button>
          ) : (
            <div className="space-y-2.5">
              <Button
                className="w-full"
                size="lg"
                loading={busy}
                onClick={() =>
                  void joinAsGuest().then((joined) => {
                    if (joined) close();
                  })
                }
              >
                Take a free seat
              </Button>
              <div className="grid grid-cols-2 gap-2.5">
                <WalletPlayButton
                  size="sm"
                  onReady={async () => {
                    close();
                    await joinFloor();
                  }}
                />
                <Button variant="ghost" size="sm" onClick={close}>
                  <Eye aria-hidden className="size-4" /> Just watch
                </Button>
              </div>
              <p className="text-faint pt-1 text-center text-[11px]">
                Runs on Solana devnet. Chips are play money with no value.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
