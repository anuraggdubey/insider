"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Readout({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  format?: ComponentProps<typeof NumberFlow>["format"];
}) {
  const previous = useRef(value);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value === previous.current) return;
    const next = value > previous.current ? "up" : "down";
    const timer = setTimeout(() => setDirection(next), 0);
    const clear = setTimeout(() => setDirection(null), 400);
    previous.current = value;
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [value]);
  return (
    <NumberFlow
      value={value}
      format={format}
      className={cn(
        "led-readout",
        direction === "up" && "!text-buy",
        direction === "down" && "!text-sell",
        className,
      )}
    />
  );
}
