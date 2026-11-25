import type { TableView } from "@insider/sdk";
import { TICK_MILLIS } from "@insider/sdk/constants";
import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const steps = ["Sit down", "Send an order", "Get a capsule", "X-ray"];

/**
 * The "what do I do now?" strip. It only reads the table view; it never changes the round.
 */
export function FloorCoach({ view, xrayHref }: { view: TableView; xrayHref: string }) {
  const seated = Boolean(view.mine);
  const holdsLeak = view.leaks.some((leak) => leak.isMine && leak.state !== 0);
  const current = view.phase === "xray" ? 3 : !seated ? 0 : holdsLeak ? 2 : 1;
  const landing = view.myPending.length
    ? Math.min(...view.myPending.map((order) => order.ticksToLand))
    : null;

  let hint: string;
  if (view.phase === "xray") hint = "Round over. Open the X-ray to see every secret.";
  else if (view.phase === "idle" || view.phase === "seeding")
    hint = seated
      ? "You're seated. The next round starts shortly."
      : "Grab a seat now so you're ready for the next round.";
  else if (!seated) hint = "You're watching. Play as guest to join: free, no wallet needed.";
  else if (view.mine?.liquidated)
    hint = "You're out for this round. Watch the tape and come back next round.";
  else if (view.phase === "closing") hint = "Orders are closed. The last ones are landing now.";
  else if (landing !== null)
    hint = `Order sealed. It lands in ${((landing * TICK_MILLIS) / 1000).toFixed(1)}s.`;
  else if (holdsLeak) hint = "You have a capsule. Open it for the secret, or flip it to a rival.";
  else hint = "Your move: pick Buy or Sell, choose a size, then Send.";

  return (
    <section
      aria-label="Round guide"
      data-testid="floor-coach"
      className="floor-coach border-line bg-surface mb-3 flex shrink-0 flex-col gap-2 rounded-xl border px-3 py-2.5 lg:flex-row lg:items-center lg:gap-4"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const state = index === current ? "current" : index < current ? "done" : "next";
          return (
            <li
              key={step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "coach-step border-line bg-surface-2 text-muted items-center gap-1.5 rounded-full border-2 py-1 pr-3 pl-1.5 font-[family-name:var(--font-display)] text-[13px] font-semibold",
                state === "current" ? "flex" : "hidden sm:flex",
              )}
            >
              <span className="bg-surface text-ink grid size-5 place-items-center rounded-full font-mono text-[10px] font-bold">
                {state === "done" ? <Check aria-hidden className="size-3" /> : index + 1}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
      <p className="text-ink min-w-0 flex-1 text-sm font-bold lg:text-right">
        {hint}
        {!seated && view.phase !== "xray" && (
          <Link
            href="#join-seat"
            className="text-brand coach-pulse ml-2 inline-block underline underline-offset-4"
          >
            Take a seat
          </Link>
        )}
        {view.phase === "xray" && (
          <Link
            href={xrayHref}
            prefetch={false}
            className="text-brand ml-2 inline-block underline underline-offset-4"
          >
            Open it
          </Link>
        )}
      </p>
    </section>
  );
}
