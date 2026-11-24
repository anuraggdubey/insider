import { Badge, type BadgeTone } from "./badge";
import { cn } from "@/lib/cn";

export type Rarity = "common" | "rare" | "epic";

const capsuleTop: Record<Rarity, string> = {
  common: "#9aa3ae",
  rare: "#2f7de1",
  epic: "#d61f9a",
};

/** A gumball-machine capsule: the top half pops off when the Leak is opened. */
export function Capsule({ rarity, opened }: { rarity: Rarity; opened: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="capsule h-28 w-28" role="img" aria-label="Leak capsule">
      {/* bottom half */}
      <path d="M18 60a42 42 0 0 0 84 0Z" fill="#fffdf5" stroke="#15132b" strokeWidth="5" />
      {/* seam band */}
      <rect x="16" y="54" width="88" height="10" rx="5" fill="#15132b" />
      {/* top half (animated via .capsule-top) */}
      <g className="capsule-top">
        <path
          d="M18 60a42 42 0 0 1 84 0Z"
          fill={capsuleTop[rarity]}
          stroke="#15132b"
          strokeWidth="5"
        />
        <ellipse cx="44" cy="40" rx="12" ry="8" fill="#ffffff" opacity="0.55" />
      </g>
      {opened && <circle cx="60" cy="66" r="9" fill="#ffc83d" stroke="#15132b" strokeWidth="4" />}
    </svg>
  );
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
      <div className="bob flex min-h-40 items-center justify-center py-2">
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
