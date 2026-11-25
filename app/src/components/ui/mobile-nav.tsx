"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/dialog-focus";
import { SoundButton } from "./sound-button";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function MobileNav({ items }: { items: string[][] }) {
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useDialogFocus(open, () => setOpenedAt(null));
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const closeForWallet = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        dialog.current?.contains(target) &&
        target.closest(".wallet-adapter-button")
      ) {
        timer = setTimeout(() => setOpenedAt(null), 0);
      }
    };
    document.addEventListener("click", closeForWallet, true);
    return () => {
      document.removeEventListener("click", closeForWallet, true);
      if (timer) clearTimeout(timer);
    };
  }, [open, dialog]);
  return (
    <div className="ml-auto md:hidden">
      <button
        ref={button}
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls={open ? "mobile-navigation" : undefined}
        className="btn btn-outline grid size-10 place-items-center"
        onClick={() => setOpenedAt(open ? null : pathname)}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#06103a]/70"
          onClick={() => setOpenedAt(null)}
        >
          <div
            ref={dialog}
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            className="border-primary bg-surface w-full rounded-t-3xl border-t-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="micro-label">Where to?</span>
              <button
                type="button"
                className="btn btn-ghost grid size-10 place-items-center"
                aria-label="Close navigation"
                onClick={() => setOpenedAt(null)}
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="mt-3 grid gap-2">
              {items.map(([label, href], index) => (
                <Link
                  key={href}
                  href={href!}
                  prefetch={false}
                  onClick={() => setOpenedAt(null)}
                  aria-current={pathname === href ? "page" : undefined}
                  className="border-line bg-surface-2 hover:border-primary aria-[current=page]:bg-primary aria-[current=page]:border-primary flex min-h-12 items-center justify-between rounded-2xl border-2 px-4 font-[family-name:var(--font-display)] text-lg font-semibold aria-[current=page]:text-white"
                >
                  {label}
                  <span className="font-mono text-xs opacity-70">0{index + 1}</span>
                </Link>
              ))}
            </nav>
            <div className="border-line mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
              <ThemeToggle />
              <SoundButton />
              <WalletButton id="insider-wallet-button-mobile" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
