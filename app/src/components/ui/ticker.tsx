"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function Ticker({ events, className }: { events: string[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let visible = false;
    const sync = () => {
      node.dataset.active = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  if (!events.length) return null;
  return (
    <div
      className={cn("border-line overflow-hidden border-y", className)}
      aria-label="Public events"
    >
      <div
        ref={track}
        className="ticker-track text-muted flex w-max gap-8 py-3 font-mono text-[11px] tracking-wider uppercase"
      >
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex gap-8">
            {events.map((event, i) => (
              <span key={`${i}-${event}`}>
                <span className="text-sealed mr-3">◆</span>
                {event}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
