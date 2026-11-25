import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Screen({
  label,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { label?: ReactNode }) {
  return (
    <section className={cn("screen overflow-hidden rounded-xl", className)} {...props}>
      {label && (
        <div className="border-line text-muted border-b px-4 py-2 font-mono text-[10px] tracking-wider uppercase">
          {label}
        </div>
      )}
      {children}
    </section>
  );
}
