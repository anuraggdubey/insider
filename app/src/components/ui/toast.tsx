"use client";

import { X } from "lucide-react";
import { create } from "zustand";

type ToastItem = { id: number; message: string };
type ToastStore = {
  items: ToastItem[];
  add: (message: string) => void;
  dismiss: (id: number) => void;
};
let nextId = 0;
export const useToast = create<ToastStore>((set, get) => ({
  items: [],
  add: (message) => {
    const id = ++nextId;
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    set((state) => ({ items: mobile ? [{ id, message }] : [...state.items, { id, message }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) =>
    set((state) => {
      const mobile =
        typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
      return {
        items:
          mobile && state.items.at(-1)?.id === id
            ? []
            : state.items.filter((item) => item.id !== id),
      };
    }),
}));

export function Toaster() {
  const items = useToast((state) => state.items);
  const dismiss = useToast((state) => state.dismiss);
  return (
    <div
      className="fixed right-4 bottom-[9rem] z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 md:bottom-16"
      aria-live="polite"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="status"
          className={`toast-in border-ink bg-surface text-text items-center justify-between gap-3 border-2 px-3 py-2 font-mono text-[10px] font-bold uppercase md:flex md:gap-4 md:p-4 md:text-xs ${index === items.length - 1 ? "flex" : "hidden"}`}
        >
          {item.message}
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
            className="text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
