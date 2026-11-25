"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { CapsuleArt } from "./capsule-art";

export type CapsuleRarity = "common" | "rare" | "epic";
export type CapsuleState = "sealed" | "owned" | "listed" | "opened" | "expired";

const fills: Record<CapsuleRarity, string> = {
  common: "#ffc52e",
  rare: "#22b4f0",
  epic: "#7448f5",
};
const subscribe = () => () => {};

/** A capsule that drops, pops and wiggles, for the live game screens. */
export function Capsule({
  rarity = "common",
  state = "sealed",
  size = 64,
  label,
  mine = false,
  motion = "drop",
  topColor,
  decorative = false,
  className,
}: {
  rarity?: CapsuleRarity;
  state?: CapsuleState;
  size?: number;
  label?: string;
  mine?: boolean;
  motion?: "drop" | "pop" | "none";
  /** A seat colour. Plain order capsules use it and carry no "?". */
  topColor?: string;
  decorative?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <LazyMotion features={domAnimation}>
      <m.span
        className={cn("relative inline-flex flex-col items-center", className)}
        initial={false}
        animate={
          !hydrated || reduced || motion === "none"
            ? undefined
            : motion === "drop"
              ? { y: [-90, 0, 0, 0], scaleY: [1, 0.85, 1.07, 1] }
              : { scale: [1, 1.15, 1] }
        }
        transition={{ duration: motion === "drop" ? 0.6 : 0.3 }}
        whileHover={reduced ? undefined : { rotate: [0, -7, 6, 0] }}
      >
        <CapsuleArt
          color={topColor ?? fills[rarity]}
          size={size}
          mark={!topColor}
          markColor={!topColor && rarity === "common" ? "#2b2b33" : "#ffffff"}
          open={state === "opened"}
          mine={mine}
          label={decorative ? undefined : `${rarity} capsule, ${state}${mine ? ", yours" : ""}`}
          className={state === "expired" ? "opacity-40 grayscale" : undefined}
        />
        {label && <span className="micro-label mt-1 text-center">{label}</span>}
      </m.span>
    </LazyMotion>
  );
}
