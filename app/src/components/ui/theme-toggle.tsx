"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

/** Light / dark switch. The first paint is set by the inline script in the layout. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("insider.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="border-line-strong text-muted hover:text-text bg-surface grid size-10 shrink-0 place-items-center rounded-xl border transition-colors"
      onClick={toggle}
    >
      {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
    </button>
  );
}
