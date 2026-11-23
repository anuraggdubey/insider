import { cn } from "@/lib/cn";

export function Countdown({
  ticks,
  totalTicks,
  className,
}: {
  ticks: number;
  totalTicks: number;
  className?: string;
}) {
  const remaining = Math.max(0, ticks);
  const progress = Math.min(100, Math.max(0, totalTicks > 0 ? (remaining / totalTicks) * 100 : 0));
  return (
    <div className={cn("min-w-24", className)}>
      <div className="flex justify-between gap-4 font-mono text-xs tabular-nums">
        <span className="text-muted">REMAINING</span>
        <span>{(remaining / 2).toFixed(1)}s</span>
      </div>
      <div
        role="progressbar"
        aria-label="Time remaining"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="bg-line mt-2 h-1 overflow-hidden rounded-full"
      >
        <div className="bg-sealed h-full rounded-full" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
