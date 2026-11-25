"use client";

import { LazyMotion, domMax, m, useReducedMotion } from "framer-motion";

export default function NavIndicator() {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domMax}>
      <m.span
        aria-hidden
        className="bg-signal absolute inset-0 rounded-full"
        layoutId={reduced ? undefined : "active-channel"}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
      />
    </LazyMotion>
  );
}
