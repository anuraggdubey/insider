import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * The X-ray view of a capsule: dark glass while sealed, lit in the seat's colour with the
 * order inside once revealed.
 */
export function GlassCapsule({
  name,
  order,
  revealed,
  color,
  className,
}: {
  name: string;
  order: string;
  revealed: boolean;
  color: string;
  className?: string;
}) {
  const [side, ...size] = order.split(" ");
  return (
    <span
      className={cn("glass-capsule", revealed && "is-revealed", className)}
      style={{ "--glass": color } as CSSProperties}
    >
      <span className="glass-card">
        <span className="block truncate text-[9px] font-bold opacity-80">{name}</span>
        <span
          className={cn(
            "block text-[11px] leading-tight font-black",
            side === "BUY" && "text-[#5ff0e0]",
            side === "SELL" && "text-[#ff8fd0]",
          )}
        >
          {side}
        </span>
        {size.length > 0 && (
          <span className="block text-base leading-none font-black tabular-nums">
            {size.join(" ")}
          </span>
        )}
      </span>
    </span>
  );
}
