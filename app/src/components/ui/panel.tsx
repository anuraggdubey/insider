import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  title,
  label,
  action,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: string;
  label?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={cn("border-line bg-surface overflow-hidden rounded-lg border", className)}
      {...props}
    >
      {(title || label || action) && (
        <div className="border-line flex min-h-11 items-center justify-between gap-4 border-b px-4">
          <div className="flex items-center gap-3">
            {title && <h3 className="micro-label">{title}</h3>}
            {label && <span className="micro-label">{label}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
