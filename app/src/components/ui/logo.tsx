import Link from "next/link";
import { cn } from "@/lib/cn";

/** The INSIDER capsule: a glossy yellow lid with a "?" on a white shell. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 124" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <ellipse cx="64" cy="115" rx="42" ry="7" fill="#0b1440" opacity=".14" />
      <path d="M12 60a48 48 0 0 0 96 0Z" fill="#f4f4f7" />
      <path d="M20 82a48 48 0 0 0 80 0Q60 98 20 82Z" fill="#d5d7df" opacity=".75" />
      <path d="M12 60a48 48 0 0 1 96 0Q60 69 12 60Z" fill="#ffc52e" />
      <rect
        x="28"
        y="26"
        width="18"
        height="15"
        rx="4"
        transform="rotate(28 37 33)"
        fill="#fff"
        opacity=".45"
      />
      <path
        d="M51 29c0-8 5-11 11-11s10 4 10 10-9 7-9 14"
        fill="none"
        stroke="#2b2b33"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="63" cy="53" r="4.8" fill="#2b2b33" />
      <path d="M13 60Q60 69 107 60" fill="none" stroke="#fff" strokeWidth="3" />
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
        "group flex shrink-0 items-center gap-2.5 font-[family-name:var(--font-brand)] tracking-[.03em]",
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
