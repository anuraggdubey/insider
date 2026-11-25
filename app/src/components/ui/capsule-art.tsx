import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

const mix = (color: string, other: string, amount: number) =>
  `color-mix(in srgb, ${color} ${100 - amount}%, ${other})`;
const move = (transform: string | undefined, delay = 0): CSSProperties => ({
  transform,
  transition: `transform 400ms ease-out ${delay}ms, opacity 400ms ease-out ${delay}ms`,
});

/**
 * The glossy two-part capsule from the launch film as plain SVG: a coloured lid on a white
 * shell. It has no animation library, so shared page chrome can use it cheaply.
 */
export function CapsuleArt({
  color,
  size = 64,
  mark = false,
  markColor = "#ffffff",
  open = false,
  mine = false,
  innerCard = true,
  label,
  className,
}: {
  color: string;
  size?: number;
  /** The "?" on the lid. */
  mark?: boolean;
  markColor?: string;
  open?: boolean;
  mine?: boolean;
  /** The little order card that rises out of an opened capsule. */
  innerCard?: boolean;
  /** Accessible name. Without one the capsule is decoration. */
  label?: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const card = open && innerCard;
  return (
    <svg
      className={cn("overflow-visible", className)}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <radialGradient id={`${id}-lid`} cx="38%" cy="22%" r="95%">
          <stop offset="0" style={{ stopColor: mix(color, "white", 32) }} />
          <stop offset="0.5" style={{ stopColor: color }} />
          <stop offset="1" style={{ stopColor: mix(color, "black", 22) }} />
        </radialGradient>
        <radialGradient id={`${id}-shell`} cx="42%" cy="10%" r="100%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#f1f1f3" />
          <stop offset="1" stopColor="#c9cbd4" />
        </radialGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#0b1440" stopOpacity="0.32" />
          <stop offset="1" stopColor="#0b1440" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="66" cy="106" rx="46" ry="9" fill={`url(#${id}-shadow)`} />
      <path
        d="M14 58a46 46 0 0 0 92 0Z"
        fill={`url(#${id}-shell)`}
        stroke="#3b4673"
        strokeOpacity="0.28"
        strokeWidth="1.6"
      />
      {open && (
        <ellipse cx="60" cy="58" rx="45" ry="7.5" fill="#d9d9de" stroke="#fff" strokeWidth="2" />
      )}
      <g
        style={{
          ...move(`translateY(${card ? -6 : 14}px)`, card ? 120 : 0),
          opacity: card ? 1 : 0,
        }}
      >
        <rect x="36" y="34" width="44" height="30" rx="6" style={{ fill: color }} />
        <rect x="42" y="42" width="18" height="4.5" rx="2.25" fill="#fff" />
        <rect x="42" y="51" width="30" height="6.5" rx="3.25" fill="#fff" />
      </g>
      <g
        style={{
          ...move(open ? "translate(14px, -34px) rotate(30deg)" : undefined),
          transformOrigin: "60px 40px",
        }}
      >
        <path d="M14 58a46 46 0 0 1 92 0Q60 66 14 58Z" fill={`url(#${id}-lid)`} />
        <rect
          x="31"
          y="25"
          width="17"
          height="14"
          rx="4"
          fill="#fff"
          opacity="0.3"
          transform="rotate(28 39.5 32)"
        />
        <path
          d="M91 34q8 10 9 20"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        {mark && (
          <>
            <path
              d="M52 29c0-7 5-10 10-10s9 3.5 9 9-8 6.5-8 13"
              fill="none"
              style={{ stroke: markColor }}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="63" cy="51" r="4.2" style={{ fill: markColor }} />
          </>
        )}
        <path
          d="M14.5 58Q60 66 105.5 58"
          fill="none"
          strokeLinecap="round"
          style={{ stroke: mine ? "var(--color-you)" : "#fff" }}
          strokeWidth={mine ? 6 : 2.4}
        />
      </g>
    </svg>
  );
}
