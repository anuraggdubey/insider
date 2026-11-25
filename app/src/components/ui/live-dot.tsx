"use client";

import { useEffect, useRef } from "react";

export function LiveDot() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = false;
    const sync = () => {
      node.style.animationPlayState = visible && !document.hidden ? "running" : "paused";
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <span ref={ref} aria-hidden className="live-dot mr-1.5 size-1.5 rounded-full bg-current" />
  );
}
