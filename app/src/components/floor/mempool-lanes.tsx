"use client";

import { TICK_MILLIS } from "@insider/sdk/constants";
import type { TableSnapshot, TableView } from "@insider/sdk";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Capsule } from "@/components/ui/capsule";
import { Panel } from "@/components/ui/panel";
import { mempoolLanes } from "@/lib/mempool-lanes";
import { bouncy, reducedTransition } from "@/lib/motion";

export function MempoolLanes({ snapshot, view }: { snapshot: TableSnapshot; view: TableView }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let intersects = false;
    const sync = () => setVisible(intersects && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersects = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const { standardDelay, priorityDelay } = snapshot.table.params;
  const orders = mempoolLanes({
    tape: snapshot.tape,
    tick: view.tick,
    phase: view.phase,
    standardDelay,
    priorityDelay,
    mySeat: view.mine?.index,
    pending: view.myPending,
  });
  const count = Math.min(snapshot.tape.sendsHead, snapshot.tape.sends.length);
  const recent = Array.from(
    { length: count },
    (_, i) =>
      snapshot.tape.sends[(snapshot.tape.sendsHead - count + i) % snapshot.tape.sends.length]!,
  );
  return (
    <div ref={host}>
      <Panel
        title="Mempool / sealed"
        action={<span className="micro-label">Public sends · private orders</span>}
        className="shrink-0"
      >
        <div className="space-y-2 p-3" aria-label="Mempool lanes">
          {[1, 0].map((lane) => {
            const delay = lane ? priorityDelay : standardDelay;
            const onLane = orders.filter((order) => order.lane === lane);
            const landing = recent.some(
              (event) => event.lane === lane && event.sentTick + delay === view.tick,
            );
            return (
              <div key={lane} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                <div className="font-mono text-[9px] leading-4 font-bold">
                  <span className={lane ? "text-priority" : "text-ink"}>
                    {lane ? "PRIORITY" : "STANDARD"}
                  </span>
                  <br />
                  <span className="text-muted">{(delay * TICK_MILLIS) / 1000}s</span>
                </div>
                <div
                  data-testid={`mempool-lane-${lane ? "priority" : "standard"}`}
                  className="border-line-strong bg-surface-2 relative h-14 overflow-hidden rounded-md border"
                >
                  <svg
                    className="absolute inset-0 size-full"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 9 }, (_, i) => (
                      <line
                        key={i}
                        x1={`${(i + 1) * 10}%`}
                        x2={`${(i + 1) * 10}%`}
                        y1="42"
                        y2="50"
                        stroke="var(--color-line-strong)"
                        strokeWidth="1"
                      />
                    ))}
                  </svg>
                  <span
                    key={`${lane}-${view.tick}`}
                    className={`lane-land border-priority absolute inset-y-0 right-2 border-r-2 border-dashed ${landing ? "lane-land-flash" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="text-priority absolute top-0 right-3 font-mono text-[7px]">
                    LAND
                  </span>
                  {!onLane.length && (
                    <span className="text-muted absolute top-4 left-3 font-mono text-[9px]">
                      NO ORDERS IN THIS LANE
                    </span>
                  )}
                  <AnimatePresence initial={false}>
                    {onLane.map((order, index) => {
                      const start = Math.max(0, Math.min(1, (view.tick - order.sentTick) / delay));
                      const end = Math.max(
                        0,
                        Math.min(1, (view.tick + 1 - order.sentTick) / delay),
                      );
                      const position = (fraction: number) =>
                        `calc(${fraction * 100}% - ${fraction * 94}px)`;
                      const seat = view.seats.find((item) => item.index === order.seat);
                      return (
                        <motion.div
                          key={order.key}
                          initial={
                            reducedMotion ? false : { opacity: 0, scale: order.mine ? 0.8 : 1 }
                          }
                          animate={{ opacity: 1, scale: 1 }}
                          exit={
                            reducedMotion
                              ? { opacity: 0, transition: reducedTransition }
                              : { opacity: 0, y: 38, transition: { duration: 0.25 } }
                          }
                          transition={reducedMotion ? reducedTransition : bouncy}
                          className="pointer-events-none absolute inset-x-0"
                          style={{ top: 2 + (index % 2) * 14 }}
                        >
                          <div
                            key={view.tick}
                            data-testid="mempool-order"
                            data-seat={order.seat}
                            data-lane={order.lane}
                            data-sent-tick={order.sentTick}
                            data-mine={order.mine}
                            className="lane-traveler flex w-full items-center"
                            style={
                              {
                                "--lane-start": position(start),
                                "--lane-end": position(end),
                                animationDuration: `${TICK_MILLIS}ms`,
                                animationPlayState: visible ? "running" : "paused",
                              } as React.CSSProperties
                            }
                            aria-label={`${order.mine ? "Your" : (seat?.name ?? `Seat ${order.seat + 1}`)} ${lane ? "priority" : "standard"} order${order.sideSize !== undefined ? `, ${order.sideSize > 0 ? "buy" : "sell"} ${Math.abs(order.sideSize)}` : ", sealed"}`}
                          >
                            <Capsule
                              size={29}
                              rarity="common"
                              state="sealed"
                              motion="none"
                              mine={order.mine}
                              topColor={
                                order.mine
                                  ? "var(--color-you)"
                                  : lane
                                    ? "var(--color-signal)"
                                    : "#161513"
                              }
                            />
                            <span className="text-ink ml-1 w-16 truncate font-mono text-[8px] font-bold">
                              {order.sideSize !== undefined
                                ? `${order.sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(order.sideSize)}`
                                : order.mine
                                  ? "YOU"
                                  : (seat?.name ?? `SEAT ${order.seat + 1}`)}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
