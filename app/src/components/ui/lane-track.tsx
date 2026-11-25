import type { ReactNode, Ref } from "react";

export function LaneTrack({
  children,
  height = 56,
  landing = false,
  flashKey,
  trackRef,
  testId,
}: {
  children?: ReactNode;
  height?: number;
  landing?: boolean;
  flashKey?: string;
  trackRef?: Ref<HTMLDivElement>;
  testId?: string;
}) {
  return (
    <div
      ref={trackRef}
      data-testid={testId}
      className="border-line-strong bg-surface-2 relative min-w-0 overflow-hidden rounded-xl border-2"
      style={{ height }}
    >
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => (
          <line
            key={index}
            x1={`${(index + 1) * 10}%`}
            x2={`${(index + 1) * 10}%`}
            y1={height - 14}
            y2={height - 6}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
          />
        ))}
      </svg>
      <span
        key={flashKey}
        className={`lane-land border-priority absolute inset-y-0 right-2 border-r-2 border-dashed ${landing ? "lane-land-flash" : ""}`}
        aria-hidden="true"
      />
      <span className="text-priority absolute top-0 right-3 font-mono text-[8px] font-bold">
        LAND
      </span>
      {children}
    </div>
  );
}
