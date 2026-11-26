"use client";

import { BANKROLL_CHIPS, CLOSING_END_TICK, LIVE_TICKS, TICK_MILLIS } from "@insider/sdk/constants";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FastModeToggle } from "@/components/onboarding/wallet";
import { Button } from "@/components/ui/button";
import { CapsuleArt } from "@/components/ui/capsule-art";
import { cn } from "@/lib/cn";
import { useDialogFocus } from "@/lib/dialog-focus";
import { YOU_COLOR } from "@/lib/seat-colors";

const tradeSeconds = (LIVE_TICKS * TICK_MILLIS) / 1000;
const roundSeconds = (CLOSING_END_TICK * TICK_MILLIS) / 1000;

export type GuideLanes = { standard: number; priority: number; fee: number };

function slides({ standard, priority, fee }: GuideLanes) {
  return [
    {
      color: YOU_COLOR,
      mark: false,
      kicker: "The goal",
      title: "Finish the round with more chips",
      points: [
        `You start every round with ${BANKROLL_CHIPS.toLocaleString("en-US")} play chips. No real money.`,
        `You can trade for ${tradeSeconds} seconds. At ${roundSeconds} seconds everything closes automatically.`,
        `Your score is what you ended with, minus ${BANKROLL_CHIPS.toLocaleString("en-US")}.`,
      ],
    },
    {
      color: "#2fc073",
      mark: false,
      kicker: "Step 1 · Trade",
      title: "Guess where the price goes",
      points: [
        "Think it will rise? Press BUY. Think it will fall? Press SELL.",
        "Pick how much, then press Send. Others see that you sent an order, not what it is.",
        `It lands in ${standard}s for free, or in ${priority}s if you pay ${fee} chips for Priority.`,
      ],
    },
    {
      color: "#ffc52e",
      mark: true,
      kicker: "Step 2 · Secrets",
      title: "Grab a capsule for a private clue",
      points: [
        "Capsules drop during the round. Each price falls until someone buys or time runs out.",
        "Open yours to read it. Only you can see it, and it expires.",
        "Or resell it unread to another player at a price you set.",
      ],
    },
    {
      color: "#7448f5",
      mark: false,
      kicker: "Step 3 · Win",
      title: "Move first, then see everything",
      points: [
        "Know a big order is coming? Use Priority to trade before it lands.",
        "When the round ends, the X-ray replay reveals every order and secret.",
        "Then the next round starts and you get fresh chips.",
      ],
    },
  ];
}

export function GuideDialog({
  lanes,
  seatName,
  seatNumber,
  welcome,
  joining,
  wallet,
  seatOpen,
  onJoin,
  onTour,
  onClose,
}: {
  lanes: GuideLanes;
  seatName?: string;
  seatNumber?: number;
  /** A short "you're in" card for players who have already read the guide. */
  welcome: boolean;
  joining: boolean;
  wallet: boolean;
  seatOpen: boolean;
  onJoin: () => void;
  onTour: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const dialog = useDialogFocus(true, onClose);
  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus();
  }, [dialog, index, welcome, seatNumber]);
  const pages = slides(lanes);
  const seated = seatNumber !== undefined;
  const page = pages[index]!;
  const last = welcome || index === pages.length - 1;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#05070f]/75 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={seated ? "Welcome to the floor" : "How to play"}
      ref={dialog}
      tabIndex={-1}
    >
      <div className="studio-stage relative w-full max-w-lg p-6 sm:p-8">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted hover:text-ink absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full"
        >
          <X aria-hidden className="size-5" />
        </button>
        {seated && (
          <p className="bg-primary mb-4 w-fit rounded-full px-3 py-1 text-xs font-black text-white">
            You&apos;re in · seat {seatNumber} · {seatName}
          </p>
        )}
        <div aria-live="polite">
          {welcome ? (
            <>
              <h2 className="text-2xl">Ready when you are</h2>
              <p className="text-muted mt-2 text-sm leading-6 font-semibold">
                Buy if you expect the price to rise, sell if you expect it to fall, and grab
                capsules for private clues. The bar at the top of the floor always shows your next
                move.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span className="shrink-0">
                  <CapsuleArt size={72} color={page.color} mark={page.mark} markColor="#2b2b33" />
                </span>
                <div className="min-w-0 pr-8">
                  <span className="micro-label text-brand">{page.kicker}</span>
                  <h2 className="mt-1 text-2xl leading-tight">{page.title}</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {page.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-6 font-semibold">
                    <Check aria-hidden className="text-brand mt-1 size-4 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {wallet && seated && (
          <div className="mt-5">
            <FastModeToggle walletOnly />
          </div>
        )}
        {!welcome && (
          <div className="mt-6 flex items-center gap-2">
            {pages.map((item, dot) => (
              <button
                key={item.kicker}
                type="button"
                aria-label={`Show ${item.kicker}`}
                aria-current={dot === index ? "step" : undefined}
                onClick={() => setIndex(dot)}
                className={cn(
                  "h-2.5 cursor-pointer rounded-full transition-all",
                  dot === index ? "bg-primary w-8" : "bg-line-strong w-2.5",
                )}
              />
            ))}
            <span className="text-muted ml-auto text-xs font-bold">
              {index + 1} of {pages.length}
            </span>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!welcome && index > 0 && (
            <Button variant="outline" onClick={() => setIndex(index - 1)}>
              <ArrowLeft aria-hidden className="size-4" /> Back
            </Button>
          )}
          {!last ? (
            <Button className="ml-auto" onClick={() => setIndex(index + 1)}>
              Next <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : seated ? (
            <Button className="ml-auto" onClick={onClose}>
              Start playing
            </Button>
          ) : !seatOpen ? (
            <>
              <span className="text-muted ml-auto text-xs font-bold">Every seat is busy</span>
              <Button onClick={onClose}>Watch the round</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Just watch
              </Button>
              <Button variant="sun" onClick={onJoin} loading={joining}>
                {wallet ? "Take a seat" : "Play as guest"}
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onTour}
          className="text-brand mt-4 w-full cursor-pointer text-center text-sm font-extrabold underline underline-offset-4"
        >
          Show me around the screen
        </button>
      </div>
    </div>
  );
}
