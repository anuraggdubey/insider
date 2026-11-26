"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

const AnimatedIndicator = dynamic(() => import("./nav-indicator"), { ssr: false });
/** Desktop nav with an active-page pill. */
export function MainNav({ items }: { items: string[][] }) {
  const pathname = usePathname();
  const [animate, setAnimate] = useState(false);
  return (
    <nav
      aria-label="Main navigation"
      className="bg-surface-2 border-line hidden items-center gap-0.5 rounded-full border-2 p-1 lg:flex"
      onPointerDown={() => setAnimate(true)}
      onKeyDown={() => setAnimate(true)}
    >
      {items.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href!}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-2.5 py-1.5 font-[family-name:var(--font-display)] text-[14px] font-semibold whitespace-nowrap transition-colors xl:px-3.5 xl:text-[15px]",
              active ? "text-white" : "text-muted hover:text-ink hover:bg-surface",
            )}
          >
            {active &&
              (animate ? (
                <AnimatedIndicator />
              ) : (
                <span aria-hidden className="bg-primary absolute inset-0 rounded-full" />
              ))}
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
