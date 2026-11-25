"use client";

import { TICK_MILLIS } from "@insider/sdk/constants";
import type { TableSnapshot, TableView } from "@insider/sdk";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Capsule } from "@/components/ui/capsule";
import { LaneTrack } from "@/components/ui/lane-track";
import { Panel } from "@/components/ui/panel";
import { currentRoundSends, mempoolLanes, stackLaneOrders } from "@/lib/mempool-lanes";
import { bouncy, reducedTransition } from "@/lib/motion";
import { seatColor } from "@/lib/seat-colors";

export function MempoolLanes({ snapshot, view }: { snapshot: TableSnapshot; view: TableView }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!track) return;
    const observer = new ResizeObserver(([entry]) => setTrackWidth(entry?.contentRect.width ?? 0));
    observer.observe(track);
    return () => observer.disconnect();
  }, [track]);
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
  const recent = currentRoundSends(snapshot.tape, view.tick).map(({ event }) => event);
  return (
    <div ref={host}>
      <Panel
        title="Sealed mempool"
        action={<span className="micro-label hidden sm:inline">Public sends · private orders</span>}
        className="shrink-0"
      >
        <div className="space-y-2 p-3" aria-label="Mempool lanes">
          {[1, 0].map((lane) => {
            const delay = lane ? priorityDelay : standardDelay;
            const onLane = orders.filter((order) => order.lane === lane);
            const stacked = stackLaneOrders(onLane, view.tick, delay, trackWidth);
            const height = Math.max(
              56,
              (Math.max(-1, ...stacked.map(({ row }) => row)) + 1) * 32 + 16,
            );
            const landing = recent.some(
              (event) => event.lane === lane && event.sentTick + delay === view.tick,
            );
            return (
              <div key={lane} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                <div className="font-mono text-[11px] leading-4 font-bold">
                  <span className={lane ? "text-priority" : "text-ink"}>
                    {lane ? "PRIORITY" : "STANDARD"}
                  </span>
                  <br />
                  <span className="text-muted">{(delay * TICK_MILLIS) / 1000}s</span>
                </div>
                <LaneTrack
                  trackRef={lane ? setTrack : undefined}
                  testId={`mempool-lane-${lane ? "priority" : "standard"}`}
                  height={height}
                  landing={landing}
                  flashKey={`${lane}-${view.tick}`}
                >
                  {!onLane.length && (
                    <span className="text-muted absolute top-4 left-3 font-mono text-[11px]">
                      NO ORDERS IN THIS LANE
                    </span>
                  )}
                  {stacked.map(({ order, row }) => {
                    const start = Math.max(0, Math.min(1, (view.tick - order.sentTick) / delay));
                    const end = Math.max(0, Math.min(1, (view.tick + 1 - order.sentTick) / delay));
                    const position = (fraction: number) =>
                      `calc(${fraction * 100}% - ${fraction * 104}px)`;
                    const seat = view.seats.find((item) => item.index === order.seat);
                    return (
                      <motion.div
                        key={order.key}
                        initial={reducedMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={reducedMotion ? reducedTransition : bouncy}
                        className="pointer-events-none absolute inset-x-0"
                        style={{ top: 9 + row * 32 }}
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
                          <motion.span
                            initial={!reducedMotion && order.mine ? { scale: 0.8 } : false}
                            animate={{ scale: 1 }}
                            transition={reducedMotion ? reducedTransition : bouncy}
                            className="inline-flex shrink-0"
                          >
                            <span className={lane ? "capsule-hop" : undefined}>
                              <Capsule
                                size={31}
                                state="sealed"
                                motion="none"
                                mine={order.mine}
                                topColor={seatColor(order.seat, view.mine?.index)}
                              />
                            </span>
                          </motion.span>
                          <span className="text-ink ml-1 w-16 truncate font-mono text-[10px] font-bold">
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
                </LaneTrack>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
