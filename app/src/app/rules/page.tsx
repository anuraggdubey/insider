import { BANKROLL_CHIPS, E1_PRIORITY_FEE_CHIPS } from "@insider/sdk";
import { ArrowRight, Eye, LockKeyhole, ScanLine } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";

const leaks: { name: string; rarity: BadgeTone; family: string; text: string }[] = [
  {
    name: "Flow",
    rarity: "common",
    family: "Order flow",
    text: "Net direction and count of orders landing in a future window.",
  },
  {
    name: "Pin",
    rarity: "common",
    family: "Fundamentals",
    text: "The fundamental price at one future tick.",
  },
  {
    name: "Drift",
    rarity: "common",
    family: "Fundamentals",
    text: "The direction and magnitude of a future move.",
  },
  {
    name: "Spotlight",
    rarity: "rare",
    family: "Order flow",
    text: "The largest pending non-whale order.",
  },
  {
    name: "Whale",
    rarity: "rare",
    family: "Order flow",
    text: "The next pending whale order within the window.",
  },
  {
    name: "Shockwave",
    rarity: "rare",
    family: "Fundamentals",
    text: "Whether a shock is coming, and when and which way.",
  },
  {
    name: "Full Book",
    rarity: "epic",
    family: "Order flow",
    text: "Up to 32 pending orders, in landing order.",
  },
  {
    name: "Summit",
    rarity: "epic",
    family: "Fundamentals",
    text: "The future high and low and when they occur.",
  },
];

export const metadata = {
  title: "Rules — INSIDER",
  description: "The lanes, leaks, and information edge in 30 seconds.",
};

export default function RulesPage() {
  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pt-16 pb-24 sm:px-8 lg:pt-20">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="micro-label text-sealed">The field guide / 30 seconds</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Information is the edge.
            </h1>
            <p className="text-muted mt-4 max-w-2xl text-sm leading-6 sm:text-base">
              Trade a moving market while orders wait in the dark. Buy a glimpse of what&apos;s
              coming, act on it, and see the whole story after the bell.
            </p>
          </div>
          <Link href="/table" className={buttonStyles({ variant: "outline", size: "md" })}>
            Open the floor <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <section aria-labelledby="lanes" className="border-line border-t pt-8">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="lanes" className="text-xl font-medium">
              Two ways in.
            </h2>
            <span className="text-faint font-mono text-[10px] uppercase">01 / Orders</span>
          </div>
          <div className="border-line bg-line grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2">
            <article className="bg-surface flex items-center justify-between gap-4 p-5">
              <div>
                <Badge>Standard</Badge>
                <p className="text-muted mt-3 text-sm">Wait in the sealed mempool.</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl">
                  10 <span className="text-muted text-sm">sec</span>
                </p>
                <p className="text-faint mt-1 font-mono text-xs uppercase">Free</p>
              </div>
            </article>
            <article className="bg-surface flex items-center justify-between gap-4 p-5">
              <div>
                <Badge tone="priority">Priority</Badge>
                <p className="text-muted mt-3 text-sm">Pay chips to jump the line.</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl">
                  2 <span className="text-muted text-sm">sec</span>
                </p>
                <p className="text-faint mt-1 font-mono text-xs uppercase">
                  {E1_PRIORITY_FEE_CHIPS} chips
                </p>
              </div>
            </article>
          </div>
          <p className="text-faint mt-3 text-xs">
            The table sets its own lane delays and priority fee. The ticket shows its live
            parameters; busy markets can delay fills beyond their target.
          </p>
        </section>

        <section aria-labelledby="leaks" className="border-line mt-12 border-t pt-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 id="leaks" className="text-xl font-medium">
                Buy a look.
              </h2>
              <p className="text-muted mt-2 max-w-3xl text-sm leading-6">
                Leaks arrive sealed in a falling-price Dutch auction. Open one and only you can read
                it; flip it sealed, or license an opened Leak to others. Up to four readers total.
                Information expires.
              </p>
            </div>
            <span className="text-faint font-mono text-[10px] uppercase">02 / Leaks</span>
          </div>
          <div className="border-line bg-line grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
            {leaks.map((leak) => (
              <article key={leak.name} className="bg-surface min-h-[155px] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{leak.name}</h3>
                  <Badge tone={leak.rarity}>{leak.rarity}</Badge>
                </div>
                <p className="text-faint mt-2 font-mono text-[10px] tracking-wider uppercase">
                  {leak.family}
                </p>
                <p className="text-muted mt-3 text-sm leading-5">{leak.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="outcome" className="border-line mt-12 border-t pt-8">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="outcome" className="text-xl font-medium">
              After the bell.
            </h2>
            <span className="text-faint font-mono text-[10px] uppercase">03 / The reveal</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <article className="border-line bg-surface rounded-lg border p-5">
              <Eye aria-hidden="true" className="text-sealed size-4" />
              <h3 className="mt-4 font-medium">Score</h3>
              <p className="text-muted mt-2 text-sm leading-6">
                Your score is equity minus your {BANKROLL_CHIPS.toLocaleString("en-US")}-chip
                starting bankroll. Positions close out at the bell.
              </p>
            </article>
            <article className="border-line bg-surface rounded-lg border p-5">
              <ScanLine aria-hidden="true" className="text-opened size-4" />
              <h3 className="mt-4 font-medium">Sandwiches &amp; X-ray</h3>
              <p className="text-muted mt-2 text-sm leading-6">
                Trade before and after a revealed order to sandwich it. X-ray reveals the
                round&apos;s order trace, Leak payloads and detected sandwiches.
              </p>
            </article>
            <article className="border-line bg-surface rounded-lg border p-5">
              <LockKeyhole aria-hidden="true" className="text-priority size-4" />
              <h3 className="mt-4 font-medium">Private vs public</h3>
              <p className="text-muted mt-2 text-sm leading-6">
                Sends show a seat and lane, not side or size. Fills and Leak headers are public.
                Payloads are private to readers until archived after their window or revealed at
                round end.
              </p>
            </article>
          </div>
        </section>
      </main>
    </PageTransition>
  );
}
