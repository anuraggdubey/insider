import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function GlowBorder({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("gcard", className)} {...props}>
      {children}
    </div>
  );
}
