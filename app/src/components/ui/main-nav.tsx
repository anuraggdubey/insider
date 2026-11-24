"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Desktop nav with an active-page pill. */
export function MainNav({ items }: { items: string[][] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
      {items.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href!}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
              active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
