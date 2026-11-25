"use client";

import { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/ui/screen";
import { MACHINE_LOOP_MS, machineFrame } from "@/lib/machine-timeline";

function DemoCapsule({
  size,
  fill = "#ffc21a",
  open = false,
}: {
  size: number;
  fill?: string;
  open?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M16 59a44 44 0 0 0 88 0Z" fill="#e9e6df" stroke="#161513" strokeWidth="5" />
      <rect
        className="demo-ticket"
        x="42"
        y="42"
        width="36"
        height="36"
        rx="3"
        fill="#f8f7f4"
        stroke="#161513"
        strokeWidth="3"
        style={{ opacity: open ? 1 : 0, transform: open ? "translateY(-14px)" : undefined }}
      />
      <g
        className="demo-lid"
        style={{ transform: open ? "translate(-10px, -18px) rotate(-18deg)" : undefined }}
      >
        <path d="M16 59a44 44 0 0 1 88 0Z" fill={fill} stroke="#161513" strokeWidth="5" />
        <ellipse cx="38" cy="35" rx="10" ry="5" fill="#fff" opacity=".55" />
        <path
          d="M51 34c0-8 5-12 11-12s10 4 10 10-10 7-10 13"
          fill="none"
          stroke="#161513"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="62" cy="51" r="3" fill="#161513" />
        <rect x="14" y="55" width="92" height="8" rx="4" fill="#161513" />
      </g>
    </svg>
  );
}

export function Machine() {
  const machine = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const [time, setTime] = useState(8000);
  useEffect(() => {
    const node = machine.current;
    if (!node) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let last = 0;
    const sync = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (media.matches) {
        setTime(8000);
        return;
      }
      if (!visible || document.hidden) return;
      last = performance.now();
      setTime(elapsed.current);
      timer = setInterval(() => {
        const now = performance.now();
        elapsed.current = (elapsed.current + now - last) % MACHINE_LOOP_MS;
        last = now;
        setTime(elapsed.current);
      }, 100);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        sync();
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      if (timer) clearInterval(timer);
    };
  }, []);
  const { stage, price, leakPrice } = machineFrame(time);
  return (
    <div ref={machine}>
      <Screen
        aria-hidden="true"
        label={
          <span className="flex justify-between">
            <span>Machine / demo 01</span>
            <span className="text-[#ffb020]">● SIMULATION</span>
          </span>
        }
        className="machine-demo p-0"
      >
        <div aria-hidden="true" className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-muted font-mono text-[10px] uppercase">Market / price</span>
              <div className="led-readout mt-1 text-4xl font-black sm:text-5xl">{price}</div>
            </div>
            <div className="border-line-strong rounded-md border px-3 py-2 text-right font-mono text-[10px]">
              <span className="text-muted">ROUND 01</span>
              <br />
              <span className="text-buy">● LIVE</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="border-line bg-surface-2 relative h-14 overflow-hidden rounded-lg border px-3 py-2">
              <span className="text-muted font-mono text-[9px]">STANDARD / 10s</span>
              <span
                className="machine-order absolute bottom-1 left-0"
                style={{ transform: `translateX(${stage >= 4 ? 72 : stage >= 1 ? 43 : 8}%)` }}
              >
                <DemoCapsule size={28} />
                <span className="text-text ml-1 font-mono text-[9px]">SILVER FOX</span>
              </span>
            </div>
            <div className="border-line bg-surface-2 relative h-14 overflow-hidden rounded-lg border px-3 py-2">
              <span className="text-priority font-mono text-[9px]">PRIORITY / 2s</span>
              {stage >= 3 && (
                <span
                  className="machine-order absolute bottom-1 left-0"
                  style={{ transform: `translateX(${stage >= 3 ? 72 : 40}%)` }}
                >
                  <DemoCapsule size={28} fill="#ff6a33" />
                  <span className="text-you ml-1 font-mono text-[9px]">
                    YOU{stage >= 5 ? " / SELL" : ""}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="border-line mt-4 grid min-h-28 grid-cols-[auto_1fr] items-center gap-4 rounded-lg border p-3">
            <span
              className="demo-drop"
              style={{
                opacity: stage >= 1 ? 1 : 0,
                transform: stage >= 1 ? "translateY(0)" : "translateY(-30px)",
              }}
            >
              <DemoCapsule size={70} fill="#2bb3e0" open={stage >= 2} />
            </span>
            <div className="min-w-0 font-mono text-[10px]">
              <div className="text-opened">RARE / {stage >= 2 ? "OPENED" : "DUTCH AUCTION"}</div>
              {stage < 2 ? (
                <div className="text-text mt-2 text-lg">
                  {stage === 0 ? "20" : leakPrice}{" "}
                  <span className="text-muted text-[10px]">CHIPS</span>
                </div>
              ) : (
                <div className="text-text mt-2 rounded border border-current p-2">
                  SILVER FOX · BUY 1,200
                  <br />
                  <span className="text-muted">LANDS IN 0:04</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex h-9 items-center justify-between font-mono text-[10px]">
            <span className="text-muted">
              {stage < 2
                ? "A SECRET IS DROPPING"
                : stage < 5
                  ? "YOU JUMP THE LINE"
                  : "TRADE COMPLETE"}
            </span>
            {stage >= 5 && (
              <span className="border-capsule text-capsule -rotate-3 border-2 px-2 py-1 font-bold">
                FRONT-RUN +412
              </span>
            )}
          </div>
        </div>
      </Screen>
      <p className="sr-only">
        A Silver Fox order enters the standard lane. A Rare Leak drops from 20 to 14 chips; you buy
        and open it, see a buy of 1,200, and enter the priority lane. Your order lands first, the
        price rises from 1.000 to 1.012, Silver Fox lands at 1.060, and your sell completes a
        front-run worth 412 chips.
      </p>
    </div>
  );
}
