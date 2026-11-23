import { LockKeyhole, UnlockKeyhole } from "lucide-react";
import { Badge, type BadgeTone } from "./badge";
import { cn } from "@/lib/cn";

export type Rarity = "common" | "rare" | "epic";
export function SealedCard({
  kind,
  rarity,
  state,
  price,
  className,
}: {
  kind: string;
  rarity: Rarity;
  state: "sealed" | "opened";
  price?: number;
  className?: string;
}) {
  const opened = state === "opened";
  return (
    <article
      className={cn(
        "sealed-card group bg-surface relative isolate overflow-hidden rounded-xl border p-5",
        opened ? "is-open border-opened/40" : "border-sealed/30",
        `rarity-${rarity}`,
        className,
      )}
    >
      <div className="sealed-shimmer pointer-events-none absolute inset-0" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <span className="micro-label">{opened ? "Decrypted leak" : "Private intelligence"}</span>
          <h3 className="mt-2 text-lg font-medium">{kind}</h3>
        </div>
        <Badge tone={rarity as BadgeTone}>{rarity}</Badge>
      </div>
      <div className="relative flex min-h-40 items-center justify-center">
        <div className="seal-emblem border-sealed/30 bg-sealed/5 text-sealed flex size-24 items-center justify-center rounded-full border shadow-[0_0_45px_rgba(90,180,255,.12)]">
          {opened ? (
            <UnlockKeyhole className="text-opened size-7" strokeWidth={1.2} />
          ) : (
            <LockKeyhole className="size-7" strokeWidth={1.2} />
          )}
          <span className="seal-crack" aria-hidden />
        </div>
      </div>
      <div className="border-line relative flex items-end justify-between border-t pt-4">
        <div>
          <span className="micro-label">{opened ? "Access" : "Status"}</span>
          <div className={cn("mt-1 font-mono text-xs", opened ? "text-opened" : "text-sealed")}>
            {opened ? "OPENED" : "SEALED"}
          </div>
        </div>
        {price !== undefined && (
          <div className="text-right">
            <span className="micro-label">Price</span>
            <div className="mt-1 font-mono text-sm tabular-nums">
              {price} <span className="text-muted">CHIPS</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
