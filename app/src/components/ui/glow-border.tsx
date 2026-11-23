import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function GlowBorder({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glow-border", className)} {...props}>
      <div className="glow-border-inner">{children}</div>
    </div>
  );
}
