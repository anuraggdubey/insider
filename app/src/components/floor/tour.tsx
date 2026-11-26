"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/lib/dialog-focus";

export type TourTab = "Trade" | "Capsules" | "Seats" | "Log";
export type TourStop = {
  /** Matches a `data-tour` attribute on the floor. */
  target: string;
  title: string;
  text: string;
  /** The phone tab that holds this panel. */
  tab?: TourTab;
};

const simpleStops: TourStop[] = [
  {
    target: "status",
    title: "The clock and your seat",
    text: "The seconds left in this phase, and your score once you join. The coloured bar shows trade time, closing and the replay.",
  },
  {
    target: "next",
    title: "Your next move",
    text: "Lost? Look here. This bar always says the most useful thing to do right now.",
  },
  {
    target: "chart",
    title: "The price",
    text: "This is what you are betting on. It moves as orders land and as the market drifts.",
    tab: "Trade",
  },
  {
    target: "trade",
    title: "Make a trade",
    text: "Pick BUY or SELL, choose how much and how fast, then press Send.",
    tab: "Trade",
  },
  {
    target: "capsules",
    title: "Secret capsules",
    text: "Private clues for sale. Buy one, open it, then trade on what you learned.",
    tab: "Capsules",
  },
];
const proStops: TourStop[] = [
  {
    target: "players",
    title: "The other players",
    text: "Bots, AI analysts and people. Each seat has its own capsule colour; yours is blue.",
    tab: "Seats",
  },
  {
    target: "lanes",
    title: "Orders on the way",
    text: "Every order travels to the right and lands at the dashed line. You see who sent it, not what it is.",
    tab: "Trade",
  },
  {
    target: "log",
    title: "Game log",
    text: "What just happened. Landed orders can be copied or faded with one click.",
    tab: "Log",
  },
];
const viewStop: TourStop = {
  target: "view",
  title: "Want more or less on screen?",
  text: "Switch between the simple view and all panels whenever you like. You're ready to play!",
};

export function tourStops(full: boolean) {
  return [...simpleStops, ...(full ? proStops : []), viewStop];
}

type Box = { top: number; left: number; width: number; height: number };

const CARD_WIDTH = 340;
const GAP = 14;

/** Where to put the explanation so it does not cover the thing it explains. */
function place(box: Box | null, card: number) {
  const width = Math.min(CARD_WIDTH, window.innerWidth - 24);
  const clampLeft = (left: number) => Math.max(12, Math.min(window.innerWidth - width - 12, left));
  const clampTop = (top: number) => Math.max(12, Math.min(window.innerHeight - card - 12, top));
  if (!box)
    return { width, left: clampLeft(window.innerWidth / 2 - width / 2), top: clampTop(120) };
  const below = box.top + box.height + GAP;
  if (below + card <= window.innerHeight - 12)
    return { width, left: clampLeft(box.left), top: below };
  const above = box.top - GAP - card;
  if (above >= 12) return { width, left: clampLeft(box.left), top: above };
  if (box.left - GAP - width >= 12)
    return { width, left: box.left - GAP - width, top: clampTop(box.top) };
  if (box.left + box.width + GAP + width <= window.innerWidth - 12)
    return { width, left: box.left + box.width + GAP, top: clampTop(box.top) };
  // A panel that fills the screen: keep the card at whichever edge hides less of its start.
  return { width, left: clampLeft(window.innerWidth / 2 - width / 2), top: clampTop(Infinity) };
}

/** A spotlight walk-through of the floor. It only scrolls and highlights. */
export function FloorTour({
  stops,
  onTab,
  onClose,
}: {
  stops: TourStop[];
  onTab: (tab: TourTab) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<{
    box: Box | null;
    card: ReturnType<typeof place>;
  } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const dialog = useDialogFocus(true, onClose);
  const stop = stops[Math.min(index, stops.length - 1)]!;
  const last = index >= stops.length - 1;

  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus();
  }, [dialog, index]);

  useEffect(() => {
    if (stop.tab) onTab(stop.tab);
  }, [stop, onTab]);

  useEffect(() => {
    const find = () => document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`);
    const measure = () => {
      const rect = find()?.getBoundingClientRect();
      const box =
        rect && rect.width && rect.height
          ? {
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }
          : null;
      setLayout({ box, card: place(box, card.current?.offsetHeight ?? 200) });
    };
    // Wait for a phone tab switch to paint before scrolling to the panel.
    const scroll = setTimeout(() => {
      const element = find();
      if (!element) return;
      // Tall panels start below the header; short ones sit in the middle of the screen.
      const tall = element.getBoundingClientRect().height > window.innerHeight * 0.5;
      element.scrollIntoView({ block: tall ? "start" : "center", behavior: "instant" });
      measure();
    }, 60);
    const timer = setInterval(measure, 200);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      clearTimeout(scroll);
      clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [stop]);

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Screen tour"
      ref={dialog}
      tabIndex={-1}
    >
      {layout?.box ? (
        <div aria-hidden className="tour-spot" style={layout.box} />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[#05070f]/70" />
      )}
      <div
        ref={card}
        className="studio-stage fixed p-5"
        style={layout ? layout.card : { visibility: "hidden", width: CARD_WIDTH }}
      >
        <div aria-live="polite">
          <span className="micro-label text-brand">
            {index + 1} of {stops.length}
          </span>
          <h2 className="mt-1 text-xl">{stop.title}</h2>
          <p className="text-muted mt-2 text-sm leading-6 font-semibold">{stop.text}</p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Skip
          </Button>
          {index > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setIndex(index - 1)}
            >
              <ArrowLeft aria-hidden className="size-4" /> Back
            </Button>
          )}
          <Button
            size="sm"
            className={index > 0 ? undefined : "ml-auto"}
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? (
              "Done"
            ) : (
              <>
                Next <ArrowRight aria-hidden className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
