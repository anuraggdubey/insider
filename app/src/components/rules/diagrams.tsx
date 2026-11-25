"use client";

import { useEffect, useRef, useState } from "react";
import { Capsule } from "@/components/ui/capsule";
import { LaneTrack } from "@/components/ui/lane-track";
import { Stamp } from "@/components/ui/stamp";

const steps = [
  ["Send sealed", "Orders wait in a public lane, with side and size hidden."],
  ["Capsules drop", "Dutch prices fall every tick until someone buys."],
  ["Peek or trade", "Open privately, flip sealed, or license to readers."],
  ["Jump the line", "Priority orders land first for a chip fee."],
  ["The X-ray", "After the bell, everyone sees what happened."],
];

export function RulesDiagrams() {
  const host = useRef<HTMLElement>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let visible = false;
    const sync = () => setRunning(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <section
      ref={host}
      aria-labelledby="rules-steps"
      className={`mt-10 ${running ? "rules-animated" : ""}`}
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id="rules-steps" className="text-xl font-bold">
          A round in five moves.
        </h2>
        <span className="text-muted font-mono text-[10px]">30 SECONDS</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([title, text], index) => (
          <article
            key={title}
            className="border-line bg-surface flex min-w-0 flex-col rounded-lg border p-4"
          >
            <div className="micro-label">
              0{index + 1} / {title}
            </div>
            <div className="my-3 grid h-20 items-center" aria-hidden="true">
              {index === 0 || index === 3 ? (
                <LaneTrack height={52}>
                  <span className="rules-lane-capsule absolute top-2 left-2 flex items-center gap-1">
                    <Capsule
                      size={31}
                      motion="none"
                      topColor={index === 3 ? "var(--color-signal)" : "#1565ff"}
                    />
                  </span>
                </LaneTrack>
              ) : index === 1 ? (
                <div className="flex items-center gap-3">
                  <span className="rules-drop-capsule">
                    <Capsule size={54} rarity="rare" motion="none" />
                  </span>
                  <span className="font-mono text-xs">
                    20 → 14
                    <br />
                    CHIPS
                  </span>
                </div>
              ) : index === 2 ? (
                <div className="flex items-center gap-2">
                  <Capsule size={54} rarity="rare" state="opened" motion="none" />
                  <span className="border-ink border px-2 py-1 font-mono text-[9px]">
                    BUY 1,200
                    <br />
                    LANDS 0:04
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Capsule size={48} state="opened" motion="none" />
                  <Stamp className="text-priority !text-[9px]">FRONT-RUN</Stamp>
                </div>
              )}
            </div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-muted mt-2 text-xs leading-5">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
