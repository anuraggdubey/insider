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
    set((state) => ({ items: [...state.items, { id, message }] }));
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

export function Toaster() {
  const items = useToast((state) => state.items);
  const dismiss = useToast((state) => state.dismiss);
  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="border-line-strong bg-surface-2 text-text flex items-center justify-between gap-4 rounded-lg border p-4 text-sm shadow-xl"
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
