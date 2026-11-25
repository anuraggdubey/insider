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
      className="bg-surface-2 border-line hidden items-center gap-0.5 rounded-full border p-1 md:flex"
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
              "relative rounded-full px-3 py-1.5 text-sm font-bold",
              active ? "text-[#161513]" : "text-muted hover:text-ink",
            )}
          >
            {active &&
              (animate ? (
                <AnimatedIndicator />
              ) : (
                <span aria-hidden className="bg-signal absolute inset-0 rounded-full" />
              ))}
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
