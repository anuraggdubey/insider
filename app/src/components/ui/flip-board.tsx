import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The split-flap price board. `flipKey` replays the flap whenever the shown value changes.
 */
export function FlipBoard({
  children,
  flipKey,
  sold = false,
  className,
}: {
  children: ReactNode;
  flipKey: string | number;
  sold?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flip-board", sold && "is-sold", className)}>
      <span key={flipKey} className="flip-face">
        {children}
      </span>
    </span>
  );
}
