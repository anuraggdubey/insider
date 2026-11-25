import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Stamp({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "stamp-in inline-flex w-fit -rotate-[4deg] rounded-md border-2 border-current px-2 py-1 font-mono text-xs font-bold tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}
