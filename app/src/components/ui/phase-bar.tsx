import { CLOSING_END_TICK, LIVE_TICKS, ROUND_TICKS } from "@insider/sdk/constants";
import { cn } from "@/lib/cn";

export function PhaseBar({ tick, className }: { tick: number; className?: string }) {
  const current = Math.max(0, Math.min(ROUND_TICKS, tick));
  return (
    <div
      className={cn("font-mono", className)}
      aria-label={`Round tick ${current} of ${ROUND_TICKS}`}
    >
      <div className="bg-line relative flex h-3 gap-0.5 overflow-visible rounded-full">
        <div
          className="bg-primary rounded-l-full"
          style={{ width: `${(LIVE_TICKS / ROUND_TICKS) * 100}%` }}
        />
        <div
          className="bg-sun"
          style={{ width: `${((CLOSING_END_TICK - LIVE_TICKS) / ROUND_TICKS) * 100}%` }}
        />
        <div
          className="bg-pop rounded-r-full"
          style={{ width: `${((ROUND_TICKS - CLOSING_END_TICK) / ROUND_TICKS) * 100}%` }}
        />
        <span
          className="bg-surface border-ink absolute -top-1 -ml-2.5 size-5 rounded-full border-[3px]"
          style={{ left: `${(current / ROUND_TICKS) * 100}%` }}
        />
      </div>
      <div className="text-muted mt-2 flex gap-0.5 pb-3 text-[9px] font-bold uppercase sm:pb-0 sm:text-[10px]">
        <span className="min-w-0" style={{ width: `${(LIVE_TICKS / ROUND_TICKS) * 100}%` }}>
          Live
        </span>
        <span
          className="min-w-0 text-center whitespace-nowrap max-sm:translate-y-3"
          style={{ width: `${((CLOSING_END_TICK - LIVE_TICKS) / ROUND_TICKS) * 100}%` }}
        >
          Closing
        </span>
        <span
          className="min-w-0 text-right whitespace-nowrap"
          style={{ width: `${((ROUND_TICKS - CLOSING_END_TICK) / ROUND_TICKS) * 100}%` }}
        >
          X-ray
        </span>
      </div>
    </div>
  );
}
