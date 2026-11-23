import { ArrowDownRight, Eye, LockKeyhole, MoveUpRight, ScanLine } from "lucide-react";
import Link from "next/link";
import { PlayButton } from "@/components/onboarding/guest";
import { buttonStyles } from "@/components/ui/button";
import { SealedCard } from "@/components/ui/sealed-card";

const beats = [
  {
    number: "01",
    icon: LockKeyhole,
    title: "Send into the dark",
    text: "Your order enters a sealed mempool. Everyone can see that you sent it. Nobody can see what it is.",
    note: "STANDARD / 10S / FREE",
    extra: "PRIORITY / 2S / 10 CHIPS",
  },
  {
    number: "02",
    icon: Eye,
    title: "Buy a look",
    text: "Bid in a Dutch auction for a Leak. It stays sealed until its owner opens it.",
    note: "PRIVATE UNTIL OPENED",
    extra: "ONE PIECE OF THE PICTURE",
  },
  {
    number: "03",
    icon: ScanLine,
    title: "Jump the line",
    text: "Use what you know to get there first. When the round ends, the X-ray shows every sandwich.",
    note: "KNOWLEDGE IS THE EDGE",
    extra: "EVERYTHING IS REVEALED",
  },
];
const infrastructure = [
  ["01", "Ephemeral Rollup", "Fast, on-chain gameplay."],
  ["02", "Private ER", "A TEE seals the order flow."],
  ["03", "Verifiable randomness", "A new path for every round."],
  ["04", "Cranks", "The market moves on schedule."],
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pt-20 pb-24 sm:px-8 lg:min-h-[680px] lg:grid-cols-[1fr_0.95fr] lg:gap-12 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <div className="border-sealed/20 bg-sealed/5 text-sealed mb-7 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[.12em] uppercase">
            <span className="bg-sealed size-1.5 rounded-full shadow-[0_0_8px_#5ab4ff]" />A market
            for information
          </div>
          <h1 className="max-w-[650px] text-[clamp(3.6rem,7vw,6.7rem)] leading-[.94] font-semibold tracking-[-.065em]">
            Front-running
            <br />
            <span className="text-muted">is the game.</span>
          </h1>
          <p className="text-muted mt-8 max-w-lg text-base leading-7 sm:text-lg">
            Every order waits 10 seconds in a TEE-sealed dark mempool.
            <br className="hidden sm:block" /> Buy a look. Jump the line.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <PlayButton />
            <a href="#how-it-works" className={buttonStyles({ variant: "outline", size: "lg" })}>
              How it works <ArrowDownRight className="text-muted size-4" />
            </a>
          </div>
          <p className="text-faint mt-10 font-mono text-[10px] leading-5 tracking-[.12em] uppercase">
            Solana devnet <span className="text-line-strong mx-1">·</span> MagicBlock Private
            Ephemeral Rollup
          </p>
        </div>
        <div
          className="border-line bg-surface/70 relative mx-auto flex min-h-[430px] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-xl border sm:min-h-[490px]"
          aria-label="Illustration of a sealed leak and an order"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(90,180,255,.12),transparent_65%)]" />
          <div className="micro-label absolute top-5 left-5">01 / The information edge</div>
          <div className="text-faint absolute top-5 right-5 font-mono text-[10px] tracking-widest">
            ILLUSTRATION
          </div>
          <svg
            viewBox="0 0 540 200"
            className="absolute right-0 bottom-8 left-0 w-full opacity-40"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 165 L38 154 L75 160 L111 132 L146 142 L181 108 L217 125 L250 92 L286 105 L320 72 L353 90 L387 46 L423 65 L458 34 L497 53 L540 16"
              stroke="#5AB4FF"
              strokeWidth="1"
            />
            <path
              d="M0 165 L38 154 L75 160 L111 132 L146 142 L181 108 L217 125 L250 92 L286 105 L320 72 L353 90 L387 46 L423 65 L458 34 L497 53 L540 16 L540 200 L0 200Z"
              fill="url(#priceFade)"
            />
            <defs>
              <linearGradient
                id="priceFade"
                x1="270"
                y1="0"
                x2="270"
                y2="200"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#5AB4FF" stopOpacity=".15" />
                <stop offset="1" stopColor="#5AB4FF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="hero-float relative z-10 w-[250px] sm:w-[270px]">
            <SealedCard
              kind="Spotlight"
              rarity="rare"
              state="sealed"
              price={20}
              className="shadow-[0_25px_80px_rgba(0,0,0,.6)]"
            />
          </div>
          <div className="order-drift border-line-strong bg-bg/95 text-muted absolute right-4 bottom-16 z-20 rounded-md border px-3 py-2 font-mono text-[10px] tracking-wider shadow-xl sm:right-8">
            <span className="text-sealed">●</span> ORDER <span className="text-faint">·</span> LANDS
            IN <span className="text-text">0:07</span>
          </div>
          <div className="text-faint absolute bottom-5 left-5 font-mono text-[10px] tracking-widest">
            THE DARK POOL / 001
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-line bg-surface/65 border-y">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <span className="micro-label text-sealed">The mechanics</span>
              <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">
                Information has a price.
              </h2>
            </div>
            <p className="text-muted max-w-xs text-sm leading-6">
              The market moves. The mempool waits. What you do in between is up to you.
            </p>
          </div>
          <div className="border-line bg-line grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
            {beats.map(({ number, icon: Icon, title, text, note, extra }) => (
              <article key={number} className="bg-surface flex min-h-[290px] flex-col p-7">
                <div className="flex items-start justify-between">
                  <span className="border-line-strong bg-surface-2 text-sealed flex size-10 items-center justify-center rounded-md border">
                    <Icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-faint font-mono text-xs">{number} / 03</span>
                </div>
                <h3 className="mt-8 text-lg font-medium tracking-tight">{title}</h3>
                <p className="text-muted mt-3 max-w-sm text-sm leading-6">{text}</p>
                <div className="border-line text-faint mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t pt-5 font-mono text-[9px] tracking-wider">
                  <span>{note}</span>
                  <span>{extra}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="micro-label text-sealed">Built in the open</span>
            <h2 className="mt-4 text-3xl font-medium tracking-tight">What&apos;s on chain.</h2>
          </div>
          <Link
            href="/proof"
            className="text-muted hover:text-sealed inline-flex items-center gap-2 font-mono text-[11px]"
          >
            EXPLORE THE PROOF <MoveUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="border-line bg-line mt-10 grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
          {infrastructure.map(([number, name, text]) => (
            <div key={name} className="bg-bg p-6">
              <div className="text-faint font-mono text-[10px]">{number} / 04</div>
              <div className="mt-6 text-sm font-medium">{name}</div>
              <p className="text-muted mt-2 text-xs leading-5">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-line border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8">
          <div className="font-mono text-xs font-bold tracking-[.16em]">
            INSIDER{" "}
            <span className="text-faint ml-3 font-normal tracking-normal">
              Built for Solana Blitz v10
            </span>
          </div>
          <a
            href="https://github.com/anuraggdubey/insider"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-text inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider"
          >
            VIEW SOURCE <MoveUpRight className="size-3" />
          </a>
        </div>
      </footer>
    </main>
  );
}
