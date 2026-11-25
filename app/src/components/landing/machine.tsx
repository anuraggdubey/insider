"use client";

import { useEffect, useRef, useState } from "react";
import { CapsuleArt } from "@/components/ui/capsule-art";
import { FlipBoard } from "@/components/ui/flip-board";
import { OrderTicket } from "@/components/ui/order-ticket";
import { MACHINE_LOOP_MS, machineFrame } from "@/lib/machine-timeline";
import { SEAT_COLORS, YOU_COLOR } from "@/lib/seat-colors";

const FOX = SEAT_COLORS[2];

function DemoLane({
  priority = false,
  progress,
  label,
  reset,
}: {
  priority?: boolean;
  progress?: number;
  label?: string;
  reset?: boolean;
}) {
  return (
    <div className="grid grid-cols-[4.6rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[5.6rem_minmax(0,1fr)]">
      <div className="text-[10px] leading-4 font-black tracking-wide">
        <span className={priority ? "text-priority" : "text-ink"}>
          {priority ? "PRIORITY" : "STANDARD"}
        </span>
        <br />
        <span className="text-muted">{priority ? "2s" : "10s"}</span>
      </div>
      <div className="lane-groove relative h-12 overflow-hidden rounded-full">
        <span className="border-priority absolute inset-y-1 right-3 border-r-2 border-dashed" />
        {progress !== undefined && (
          <span
            key={`${label}-${reset ? "reset" : "running"}`}
            className="machine-order absolute bottom-0.5 left-0"
            style={{
              transform: `translateX(calc(${progress}% - ${progress * 1.1}px))`,
              transition: "transform 100ms linear",
            }}
          >
            <span className={priority ? "capsule-hop" : undefined}>
              <CapsuleArt size={40} color={priority ? YOU_COLOR : FOX} />
            </span>
            <span className="text-ink ml-1 text-[10px] font-black whitespace-nowrap">{label}</span>
          </span>
        )}
      </div>
    </div>
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
  const { stage, price, leakPrice, standardProgress, priorityProgress } = machineFrame(time);
  const completed = time >= 8000;
  const opened = stage >= 2;
  return (
    <div ref={machine}>
      <div aria-hidden="true" className="machine-demo studio-stage p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="chip-pill">Round 01 · demo</span>
          <div className="text-right">
            <span className="micro-label">Market price</span>
            <div className="text-ink font-mono text-2xl leading-tight font-black tabular-nums">
              {price}
            </div>
          </div>
        </div>

        <div className="relative mt-2 flex h-52 items-end justify-center gap-6 sm:gap-10">
          <span key={stage === 0 ? "drop" : "rest"} className={stage === 0 ? "capsule-drop" : ""}>
            <CapsuleArt
              size={150}
              color="#ffc52e"
              mark
              markColor="#2b2b33"
              open={opened}
              innerCard={false}
            />
          </span>
          <div className="flex w-36 flex-col items-center justify-end gap-3 self-stretch pb-4">
            {opened ? (
              <span className="ticket-pop">
                <OrderTicket
                  name="Silver Fox"
                  note="in 0:04"
                  side="BUY"
                  size="1,200"
                  color={FOX}
                  className="w-36"
                />
              </span>
            ) : null}
            <FlipBoard
              flipKey={opened ? "sold" : leakPrice}
              sold={opened}
              className="w-32 text-3xl"
            >
              {opened ? "SOLD" : stage === 0 ? "20" : leakPrice}
            </FlipBoard>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <DemoLane progress={standardProgress} label="SILVER FOX" reset={time < 100} />
          <DemoLane
            priority
            progress={priorityProgress}
            label={stage >= 5 ? "YOU / SELL" : "YOU"}
          />
        </div>

        <div className="mt-4 flex h-10 items-center justify-between gap-3 text-sm font-extrabold">
          <span className="text-muted">
            {stage < 2
              ? "A secret is dropping"
              : completed
                ? "Trade complete"
                : "You jump the line"}
          </span>
          {completed && <span className="win-stamp">FRONT-RUN +412</span>}
        </div>
      </div>
      <p className="sr-only">
        A Silver Fox order enters the standard lane. A Rare Leak drops from 20 to 14 chips; you buy
        and open it, see a buy of 1,200, and enter the priority lane. Your order lands first, the
        price rises from 1.000 to 1.012, Silver Fox lands at 1.060, and your sell lands at 1.051,
        completing a front-run worth 412 chips.
      </p>
    </div>
  );
}
