import Link from "next/link";
import { cn } from "@/lib/cn";

/** The INSIDER capsule: a yellow lid with a "?" on a white base, in ink outlines. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 124" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <g transform="translate(0 2)">
        <path
          d="M14 64a46 46 0 0 0 92 0Z"
          fill="#fff"
          stroke="#0f1f5c"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M14 60a46 46 0 0 1 92 0Z"
          fill="#ffd21f"
          stroke="#0f1f5c"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <rect x="11" y="57" width="98" height="9" rx="4.5" fill="#0f1f5c" />
        <ellipse
          cx="37"
          cy="33"
          rx="9"
          ry="5"
          transform="rotate(-32 37 33)"
          fill="#fff"
          opacity=".6"
        />
        <path
          d="M49 36C49 27 54 23 61 23C68 23 73 27 73 33C73 39.5 61 40 61 45"
          fill="none"
          stroke="#0f1f5c"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="61" cy="52.6" r="3.7" fill="#0f1f5c" />
      </g>
    </svg>
  );
}

/** Mark plus wordmark, linking home. `invert` is for dark backgrounds. */
export function Logo({
  className,
  invert = false,
  size = "md",
}: {
  className?: string;
  invert?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <Link
      href="/"
      aria-label="INSIDER home"
      className={cn(
        "group flex shrink-0 items-center gap-2.5 font-[family-name:var(--font-display)] font-bold tracking-[.05em]",
        size === "lg" ? "text-4xl" : "text-2xl",
        invert ? "text-white" : "text-ink",
        className,
      )}
    >
      <LogoMark
        className={cn(
          "transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110 group-hover:-rotate-12",
          size === "lg" ? "size-14" : "size-10",
        )}
      />
      <span>INSIDER</span>
    </Link>
  );
}
