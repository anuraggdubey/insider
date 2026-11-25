"use client";

import { SEAT_NAMES } from "@insider/sdk/names";
import { useEffect, useRef, useState } from "react";
import { CapsuleArt } from "@/components/ui/capsule-art";
import { cn } from "@/lib/cn";
import { seatColor } from "@/lib/seat-colors";

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
    <div ref={container} className="studio-stage px-2 py-6 sm:px-6">
      <div className="relative mx-auto aspect-[16/13] w-full max-w-xl">
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-[family-name:var(--font-brand)] text-4xl sm:text-5xl">10</div>
            <div className="micro-label">seats at the table</div>
          </div>
        </div>
        {Array.from({ length: 10 }, (_, index) => {
          const name = SEAT_NAMES[index]!;
          const kind = index < 5 ? "bot" : index < 7 ? "AI analyst" : "human";
          const mine = index === 7;
          const active = pulse?.index === index;
          // Your seat sits at the front of the ring.
          const angle = ((index - 7) / 10) * Math.PI * 2;
          const depth = (Math.cos(angle) + 1) / 2;
          return (
            <div
              key={name}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{
                left: `${(50 + 40 * Math.sin(angle)).toFixed(2)}%`,
                top: `${(48 + 40 * Math.cos(angle)).toFixed(2)}%`,
                zIndex: Math.round(depth * 10),
                width: "19%",
              }}
              aria-label={`${name}, ${kind}${mine ? ", you" : ""}`}
            >
              <span
                className={cn(
                  "seat-token ring-capsule mx-auto block",
                  active && (pulse.priority ? "seat-token-priority" : "seat-token-standard"),
                )}
                style={{ width: `${(46 + depth * 26).toFixed(2)}%` }}
              >
                <CapsuleArt size={96} color={seatColor(index, 7)} mark={index === 4} />
              </span>
              <span
                className={cn(
                  "block text-[9px] leading-tight font-extrabold sm:text-[11px]",
                  mine ? "text-brand" : "text-muted",
                )}
              >
                {mine ? "You" : name}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-muted mt-4 text-center text-[11px] font-black tracking-wider uppercase">
        05 Bots / 02 AI / 03 Human
      </p>
    </div>
  );
}
