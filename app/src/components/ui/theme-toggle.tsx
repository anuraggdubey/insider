"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Switch } from "./switch";

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
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.content = next ? "#14307F" : "#8FCBFF";
    });
    try {
      localStorage.setItem("insider.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <Switch
      checked={dark}
      onCheckedChange={toggle}
      label={dark ? "Switch to light mode" : "Switch to dark mode"}
      off={<Sun aria-hidden className="size-4" />}
      on={<Moon aria-hidden className="size-4" />}
    />
  );
}
