import { Badge, type BadgeTone } from "./badge";
import { Capsule as CapsuleObject } from "./capsule";
import { cn } from "@/lib/cn";

export type Rarity = "common" | "rare" | "epic";

export function Capsule({ rarity, opened }: { rarity: Rarity; opened: boolean }) {
  return <CapsuleObject rarity={rarity} state={opened ? "opened" : "sealed"} size={112} />;
}

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
        "capsule-card gcard group relative isolate flex flex-col items-center p-5",
        opened && "is-open",
        className,
      )}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div>
          <span className="micro-label">{opened ? "Opened leak" : "Sealed leak"}</span>
          <h3 className="mt-1 text-lg">{kind}</h3>
        </div>
        <Badge tone={rarity as BadgeTone}>{rarity}</Badge>
      </div>
      <div className="flex min-h-40 items-center justify-center py-2">
        <Capsule rarity={rarity} opened={opened} />
      </div>
      <div className="border-line flex w-full items-end justify-between border-t pt-3">
        <div>
          <span className="micro-label">Status</span>
          <div className={cn("mt-0.5 text-sm font-bold", opened ? "text-opened" : "text-sealed")}>
            {opened ? "OPENED" : "SEALED"}
          </div>
        </div>
        {price !== undefined && (
          <div className="text-right">
            <span className="micro-label">Price</span>
            <div className="mt-0.5 text-base font-bold tabular-nums">
              {price} <span className="text-muted text-xs">CHIPS</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
