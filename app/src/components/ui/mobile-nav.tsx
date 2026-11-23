"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function MobileNav({ items }: { items: string[][] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="relative md:hidden">
      <button
        ref={button}
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls={open ? "mobile-navigation" : undefined}
        className="border-line-strong text-muted grid size-9 place-items-center rounded border"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
      </button>
      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-line-strong bg-surface absolute top-11 left-0 z-50 flex w-44 flex-col rounded-md border p-2 shadow-xl"
        >
          {items.map(([label, href]) => (
            <Link
              key={href}
              href={href!}
              prefetch={href === "/desk" || href === "/proof" ? false : undefined}
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text hover:bg-surface-2 rounded px-3 py-2 font-mono text-xs"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
