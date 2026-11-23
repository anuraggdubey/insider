"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LockKeyhole, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
  close,
}: {
  title: string;
  lines: string[];
  close: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${title}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border-opened/35 bg-surface relative w-full max-w-md overflow-hidden rounded-xl border p-8 text-center shadow-[0_0_100px_rgba(255,181,71,.12)]"
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
        <motion.div
          animate={
            reduced
              ? { opacity: 1 }
              : {
                  x: [0, -3, 3, -2, 0],
                  scale: [1, 1, 1.05, 1],
                  boxShadow: ["0 0 0px #ffb54700", "0 0 70px #ffb54770", "0 0 35px #ffb54730"],
                }
          }
          transition={{ duration: 1.2 }}
          className="border-opened/40 bg-opened/5 text-opened relative mx-auto my-8 grid size-28 place-items-center rounded-full border"
        >
          <motion.span
            aria-hidden
            className="border-opened/50 absolute inset-y-0 left-0 w-1/2 rounded-l-full border-y border-l"
            animate={
              reduced ? { opacity: 0 } : { x: [0, 0, -14], rotate: [0, 0, -8], opacity: [1, 1, 0] }
            }
            transition={{ duration: 1.3 }}
          />
          <motion.span
            aria-hidden
            className="border-opened/50 absolute inset-y-0 right-0 w-1/2 rounded-r-full border-y border-r"
            animate={
              reduced ? { opacity: 0 } : { x: [0, 0, 14], rotate: [0, 0, 8], opacity: [1, 1, 0] }
            }
            transition={{ duration: 1.3 }}
          />
          <motion.div
            animate={reduced ? { opacity: 0 } : { x: [0, 0, -18], opacity: [1, 1, 0] }}
            transition={{ duration: 1.2 }}
          >
            <LockKeyhole className="size-8" strokeWidth={1} />
          </motion.div>
          <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full">
            <motion.path
              d="M57 8 L48 34 L56 42 L39 62 L46 69 L35 92"
              fill="none"
              stroke="#ffb547"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: reduced ? 0 : 0.7 }}
            />
          </svg>
        </motion.div>
        <div className="min-h-14 space-y-1 font-mono text-xs leading-6">
          {lines.map((line, index) => (
            <div key={`${index}-${line}`}>
              <DecryptedText text={line} reduced={reduced} />
            </div>
          ))}
        </div>
        <p className="text-faint mt-4 text-[11px]">Only you and licensed readers can see this.</p>
        <Button variant="outline" size="sm" onClick={close} className="mt-5">
          Return to chart
        </Button>
      </motion.div>
    </div>
  );
}
