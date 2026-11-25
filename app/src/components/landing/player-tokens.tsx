"use client";

import { SEAT_NAMES } from "@insider/sdk/names";
import { Bot, Cpu, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function PlayerTokens() {
  const container = useRef<HTMLDivElement>(null);
  const [pulse, setPulse] = useState<{ index: number; priority: boolean } | null>(null);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (interval) clearInterval(interval);
      if (clear) clearTimeout(clear);
      interval = undefined;
      if (media.matches || document.hidden || !visible) {
        setPulse(null);
        return;
      }
      interval = setInterval(() => {
        setPulse({ index: Math.floor(Math.random() * 10), priority: Math.random() < 0.5 });
        clear = setTimeout(() => setPulse(null), 800);
      }, 2000);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(node);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      if (interval) clearInterval(interval);
      if (clear) clearTimeout(clear);
    };
  }, []);
  return (
    <div ref={container} className="gcard p-5 sm:p-8">
      <div className="micro-label mb-6">Player tokens / 10 seats</div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 10 }, (_, index) => {
          const name = SEAT_NAMES[index]!;
          const kind = index < 5 ? "bot" : index < 7 ? "AI analyst" : "human";
          const Icon = index < 5 ? Bot : index < 7 ? Cpu : UserRound;
          const mine = index === 7;
          const active = pulse?.index === index;
          return (
            <div
              key={name}
              className="min-w-0 text-center"
              aria-label={`${name}, ${kind}${mine ? ", you" : ""}`}
            >
              <div
                className={cn(
                  "seat-token border-ink relative mx-auto flex aspect-square w-full max-w-16 flex-col overflow-hidden rounded-full border-2",
                  active && (pulse.priority ? "seat-token-priority" : "seat-token-standard"),
                )}
              >
                <div
                  className={cn(
                    "grid h-1/2 place-items-center",
                    mine ? "bg-you text-white" : "bg-ink text-surface",
                    active && pulse.priority && "bg-signal !text-[#161513]",
                    active && !pulse.priority && "bg-ink text-surface",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </div>
                <div className="border-ink grid h-1/2 place-items-center border-t-2 bg-[#f8f7f4] font-mono text-[8px] font-bold text-[#161513]">
                  {mine ? "YOU" : String(index + 1).padStart(2, "0")}
                </div>
              </div>
              <span className="text-muted mt-2 block font-mono text-[9px] leading-tight">
                {name}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-muted mt-6 font-mono text-[10px] uppercase">05 Bots / 02 AI / 03 Human</p>
    </div>
  );
}
