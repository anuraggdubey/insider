import { CLOSING_END_TICK, LIVE_TICKS, ROUND_TICKS } from "@insider/sdk";
import { cn } from "@/lib/cn";

export function PhaseBar({ tick, className }: { tick: number; className?: string }) {
  const current = Math.max(0, Math.min(ROUND_TICKS, tick));
  return (
    <div
      className={cn("font-mono", className)}
      aria-label={`Round tick ${current} of ${ROUND_TICKS}`}
    >
      <div className="bg-line relative flex h-2 gap-0.5 overflow-visible rounded-full">
        <div
          className="bg-sealed/60 rounded-l-full"
          style={{ width: `${(LIVE_TICKS / ROUND_TICKS) * 100}%` }}
        />
        <div
          className="bg-opened/60"
          style={{ width: `${((CLOSING_END_TICK - LIVE_TICKS) / ROUND_TICKS) * 100}%` }}
        />
        <div
          className="bg-priority/60 rounded-r-full"
          style={{ width: `${((ROUND_TICKS - CLOSING_END_TICK) / ROUND_TICKS) * 100}%` }}
        />
        <span
          className="bg-text absolute -top-1 h-4 w-0.5 shadow-[0_0_6px_white]"
          style={{ left: `${(current / ROUND_TICKS) * 100}%` }}
        />
      </div>
      <div className="text-muted mt-2 flex justify-between text-[10px] tracking-wider uppercase">
        <span>Live</span>
        <span>Closing</span>
        <span>X-ray</span>
      </div>
    </div>
  );
}
