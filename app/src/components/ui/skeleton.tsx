import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn("skeleton bg-surface-2 rounded-md", className)} {...props} />
  );
}
