import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "border-line-strong bg-surface-2 text-muted rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
        className,
      )}
      {...props}
    />
  );
}
