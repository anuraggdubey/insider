"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export type CapsuleRarity = "common" | "rare" | "epic";
export type CapsuleState = "sealed" | "owned" | "listed" | "opened" | "expired";

const fills: Record<CapsuleRarity, string> = {
  common: "#ffc21a",
  rare: "#2bb3e0",
  epic: "#161513",
};
const subscribe = () => () => {};

export function Capsule({
  rarity = "common",
  state = "sealed",
  size = 64,
  label,
  mine = false,
  motion = "drop",
  topColor,
  className,
}: {
  rarity?: CapsuleRarity;
  state?: CapsuleState;
  size?: number;
  label?: string;
  mine?: boolean;
  motion?: "drop" | "pop" | "none";
  topColor?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const open = state === "opened";
  const mark = rarity === "epic" ? "#ffc21a" : "#161513";
  return (
    <LazyMotion features={domAnimation}>
      <m.span
        className={cn("relative inline-flex flex-col items-center", className)}
        initial={false}
        animate={
          !hydrated || reduced || motion === "none"
            ? undefined
            : motion === "drop"
              ? { y: [-90, 0, 0, 0], scaleY: [1, 0.88, 1.05, 1] }
              : { scale: [1, 1.12, 1] }
        }
        transition={{ duration: motion === "drop" ? 0.55 : 0.28 }}
        whileHover={reduced ? undefined : { rotate: [0, -5, 5, 0] }}
      >
        <svg
          className={state === "expired" ? "opacity-40 grayscale" : undefined}
          width={size}
          height={size}
          viewBox="0 0 120 120"
          role="img"
          aria-label={`${rarity} capsule, ${state}${mine ? ", yours" : ""}`}
        >
          <m.ellipse
            cx="60"
            cy="108"
            rx="36"
            ry="5"
            fill="#000"
            initial={false}
            animate={
              hydrated && !reduced && motion === "drop"
                ? { scaleX: [0.2, 1], opacity: [0, 0.12] }
                : { scaleX: 1, opacity: 0.12 }
            }
            transition={{ duration: reduced ? 0 : 0.55 }}
          />
          <path
            d="M16 59a44 44 0 0 0 88 0Z"
            className="capsule-bottom"
            stroke="#161513"
            strokeWidth="4.7"
          />
          <m.g
            initial={false}
            animate={open ? { y: -13, opacity: 1 } : { y: 8, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
          >
            <rect
              x="42"
              y="42"
              width="36"
              height="30"
              rx="3"
              fill="#f8f7f4"
              stroke="#161513"
              strokeWidth="3"
            />
            <path d="M49 51h22M49 58h16" stroke="#161513" strokeWidth="2" />
          </m.g>
          <m.g
            initial={false}
            animate={open ? { y: -18, rotate: -24 } : { y: 0, rotate: 0 }}
            style={{ transformOrigin: "60px 58px" }}
            transition={{ duration: reduced ? 0 : 0.35 }}
          >
            <path
              d="M16 59a44 44 0 0 1 88 0Z"
              fill={topColor ?? fills[rarity]}
              className={rarity === "epic" ? "capsule-epic-rim" : undefined}
              stroke="#161513"
              strokeWidth="4.7"
            />
            <ellipse
              cx="38"
              cy="35"
              rx="10"
              ry="5"
              fill="#fff"
              opacity=".55"
              transform="rotate(-28 38 35)"
            />
            <path
              d="M51 34c0-8 5-12 11-12s10 4 10 10-10 7-10 13"
              fill="none"
              stroke={mark}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="62" cy="51" r="3" fill={mark} />
            <rect
              x="14"
              y="55"
              width="92"
              height="8"
              rx="4"
              fill={mine ? "#2f5bff" : rarity === "epic" ? "#ffc21a" : "#161513"}
            />
          </m.g>
        </svg>
        {label && <span className="micro-label mt-1 text-center">{label}</span>}
      </m.span>
    </LazyMotion>
  );
}
