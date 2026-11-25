"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Capsule, type CapsuleRarity } from "@/components/ui/capsule";
import { useDialogFocus } from "@/lib/dialog-focus";
import { reducedTransition, spring } from "@/lib/motion";

function DecryptedText({ text, reduced }: { text: string; reduced: boolean | null }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        setVisible((count) => {
          if (count >= text.length) {
            clearInterval(interval);
            return count;
          }
          return count + 1;
        });
      }, 26);
    }, 900);
    return () => {
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [reduced, text]);
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
    >
      {reduced ? text : text.slice(0, visible)}
      <span className="text-opened/30">
        {reduced ? "" : text.slice(visible).replace(/[^ ]/g, "·")}
      </span>
    </motion.span>
  );
}

export function CrackOpen({
  title,
  lines,
  rarity,
  close,
  returnFocus,
}: {
  title: string;
  lines: string[];
  rarity: CapsuleRarity;
  close: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const reduced = useReducedMotion();
  const dialog = useDialogFocus(true, close, returnFocus);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setOpened(true), reduced ? 0 : 200);
    return () => clearTimeout(timer);
  }, [reduced]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${title}`}
      ref={dialog}
      tabIndex={-1}
    >
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduced ? reducedTransition : spring}
        className="border-opened/35 bg-surface relative w-full max-w-md overflow-hidden rounded-xl border p-8 text-center"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="text-muted hover:text-text absolute top-4 right-4"
        >
          <X className="size-4" />
        </button>
        <div className="micro-label text-opened">Private intelligence / decrypted</div>
        <h2 className="mt-2 text-xl font-medium">{title}</h2>
        <div className="mx-auto my-5 grid size-36 place-items-center">
          <Capsule
            rarity={rarity}
            state={opened || reduced ? "opened" : "sealed"}
            size={138}
            motion="none"
            mine
          />
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.45, duration: reduced ? 0 : 0.3 }}
          className="min-h-14 space-y-1 border-2 border-[#161513] bg-[#f8f7f4] p-4 font-mono text-xs leading-6 text-[#161513]"
        >
          <div className="mb-2 border-b border-[#b5b0a4] pb-2 text-[10px] font-bold">
            PRIVATE / PAYLOAD TICKET
          </div>
          {lines.map((line, index) => (
            <div key={`${index}-${line}`}>
              <DecryptedText text={line} reduced={reduced} />
            </div>
          ))}
        </motion.div>
        <p className="text-faint mt-4 text-[11px]">Only you and licensed readers can see this.</p>
        <Button variant="outline" size="sm" onClick={close} className="mt-5">
          Return to chart
        </Button>
      </motion.div>
    </div>
  );
}
