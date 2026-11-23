import { cn } from "@/lib/cn";

export function Ticker({ events, className }: { events: string[]; className?: string }) {
  if (!events.length) return null;
  return (
    <div
      className={cn("border-line overflow-hidden border-y", className)}
      aria-label="Public events"
    >
      <div className="ticker-track text-muted flex w-max gap-8 py-3 font-mono text-[11px] tracking-wider uppercase">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex gap-8">
            {events.map((event, i) => (
              <span key={`${i}-${event}`}>
                <span className="text-sealed mr-3">◆</span>
                {event}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
