import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Radio,
  ScanEye,
  Swords,
  Target,
  Trophy,
  Medal,
} from "lucide-react";
import {
  HeroFade,
  HorizontalRounds,
  LandingMotion,
  Parallax,
  Reveal,
  ScaleIn,
  ScrollBand,
} from "@/components/landing/motion";
import { Machine } from "@/components/landing/machine";
import { PlayerTokens } from "@/components/landing/player-tokens";
import { PlayButton } from "@/components/onboarding/play-button";
import { FastModeToggle, WalletPlayButton } from "@/components/onboarding/wallet";
import { buttonStyles } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";

const rounds = [
  {
    tag: "01",
    kicker: "The order",
    title: "Orders go in sealed",
    text: "Every move waits in the dark. No one sees its side or size until it lands.",
    tone: "sun",
    img: "/art/drop.jpg",
    alt: "A sealed order entering the machine",
  },
  {
    tag: "02",
    kicker: "The drop",
    title: "Capsules drop",
    text: "Every ten seconds a Leak appears. Its Dutch auction price falls every 500 ms.",
    tone: "sky",
    img: "/art/sold.jpg",
    alt: "A capsule beside a sold sign",
  },
  {
    tag: "03",
    kicker: "The secret",
    title: "Peek, flip or license",
    text: "Open a capsule to read it, flip it sealed or license its secret to other players.",
    tone: "pop",
    img: "/art/sold.jpg",
    alt: "A sealed capsule ready to be sold",
  },
  {
    tag: "04",
    kicker: "The edge",
    title: "Jump the line",
    text: "Use the priority lane to act on your information before the order lands.",
    tone: "mint",
    img: "/art/drop.jpg",
    alt: "An order moving through the machine",
  },
  {
    tag: "05",
    kicker: "The reveal",
    title: "Everything revealed",
    text: "After the bell, the X-ray shows every move and every sandwich.",
    tone: "sky",
    img: "/art/xray.jpg",
    alt: "An X-ray of the round",
  },
];
const modes = [
  {
    name: "The Arena",
    icon: Swords,
    tile: "bg-[#1565ff] text-[#fff]",
    href: "/table",
    copy: "Trade hidden moves and win the information game.",
    preview: "10 SEATS / 2 LANES",
  },
  {
    name: "The Desk",
    icon: Target,
    tile: "bg-[#0b8f55] text-[#fff]",
    href: "/desk",
    copy: "Make a sealed Call on the real SOL price.",
    preview: "SOL / UP OR DOWN",
  },
  {
    name: "Alpha Cup",
    icon: Trophy,
    tile: "bg-[#ffd21f] text-[#0f1f5c]",
    href: "/cup",
    copy: "Five rounds. Human seats. One prize pool.",
    preview: "5 ROUNDS / TOP 3",
  },
  {
    name: "Season",
    icon: Medal,
    tile: "bg-[#7c3aed] text-[#fff]",
    href: "/season",
    copy: "One good read can put you on the board.",
    preview: "HIGH SCORES / LIVE",
  },
  {
    name: "Watch",
    icon: Radio,
    tile: "bg-[#e6275c] text-[#fff]",
    href: "/watch",
    copy: "See the public action unfold in real time.",
    preview: "BROADCAST / LIVE",
  },
  {
    name: "X-ray",
    icon: ScanEye,
    tile: "bg-[#19b5ff] text-[#0f1f5c]",
    href: "/xray",
    copy: "After the bell, see every secret revealed.",
    preview: "REPLAY / DECLASSIFIED",
  },
];
const receipts = [
  ["01", "Private rollup", "Permissions keep orders and future data sealed."],
  ["02", "Verifiable randomness", "The market's hidden path is rolled by VRF."],
  ["03", "Cranks", "The clock and the round move on chain."],
  ["04", "Rollup speed", "A new tick every 500 milliseconds."],
  ["05", "SOAR", "Scores travel to an on-chain leaderboard."],
];

export default function Home() {
  return (
    <PageTransition>
      <LandingMotion>
        <main className="flex-1 overflow-x-clip">
          <section className="sky-hero mx-auto max-w-7xl px-5 pt-14 pb-16 sm:px-8 lg:pt-20 lg:pb-24">
            <span aria-hidden className="sky-cloud top-12 right-[40%] hidden scale-75 sm:block" />
            <span aria-hidden className="sky-cloud bottom-8 left-[40%] scale-75" />
            <HeroFade className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <span className="micro-label bg-surface border-primary text-brand inline-block rounded-full border-2 px-3 py-1">
                  A game of hidden information
                </span>
                <h1 className="hero-title mt-6 max-w-3xl text-[clamp(3.4rem,7vw,6.5rem)] leading-[0.98] font-bold">
                  Front-running is the <span className="hl">game.</span>
                </h1>
                <p className="text-ink mt-7 max-w-lg text-xl leading-8 font-bold">
                  Orders wait 10 seconds in a sealed mempool. Buy a capsule to peek. Jump the line.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <PlayButton />
                  <WalletPlayButton size="lg" />
                </div>
                <p className="text-muted mt-6 font-mono text-[11px] leading-5 font-bold uppercase">
                  No wallet, no deposit · Solana devnet · MagicBlock private rollup
                </p>
                <div className="mt-3">
                  <FastModeToggle />
                </div>
              </div>
              <Parallax distance={24}>
                <Machine />
              </Parallax>
            </HeroFade>
          </section>
          <section aria-label="The game at a glance" className="px-5 pb-14 sm:px-8">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ["90 s", "80s live / 10s closing", "bg-[#1565ff] text-white"],
                ["10 s", "X-ray after the bell", "bg-[#ffd21f] text-[#0f1f5c]"],
                ["500 ms", "per tick", "bg-[#19b5ff] text-[#0f1f5c]"],
                ["10", "seats", "bg-[#7c3aed] text-white"],
                ["0 SOL", "to play", "bg-[#2adb86] text-[#032b19]"],
              ].map(([value, label, tone]) => (
                <div
                  key={value}
                  className={`rounded-3xl border-[3px] border-[#0f1f5c] p-5 text-center shadow-[0_6px_0_#0f1f5c] last:col-span-2 sm:last:col-span-1 ${tone}`}
                >
                  <div className="font-[family-name:var(--font-display)] text-4xl font-bold">
                    {value}
                  </div>
                  <div className="mt-1 text-[11px] font-black tracking-wider uppercase">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <ScrollBand top="HIDDEN MOVES" bottom="SEALED SECRETS" />
          <HorizontalRounds rounds={rounds} />
          <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-28">
            <Reveal>
              <div>
                <span className="micro-label text-brand">The table / 10 seats</span>
                <h2 className="mt-4 text-4xl leading-tight sm:text-6xl">
                  Everyone is hiding something.
                </h2>
                <p className="text-muted mt-5 max-w-xl text-lg leading-7">
                  Bots front-run and bait. AI analysts make their calls in public. Human players
                  choose what to do with the secrets they buy.
                </p>
                <Link
                  href="/table"
                  className={buttonStyles({ variant: "outline", className: "mt-7" })}
                >
                  Meet the table <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </Reveal>
            <ScaleIn>
              <PlayerTokens />
            </ScaleIn>
          </section>
          <section className="bg-surface-2 border-line border-y-2">
            <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
              <span className="micro-label text-brand">Pick your game</span>
              <h2 className="mt-4 text-4xl sm:text-6xl">Game modes.</h2>
              <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {modes.map((mode) => (
                  <li key={mode.name}>
                    <Link
                      href={mode.href}
                      prefetch={false}
                      className="gcard group flex h-full flex-col p-5"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span
                          className={`grid size-14 place-items-center rounded-2xl border-[3px] border-[#0f1f5c] shadow-[0_4px_0_#0f1f5c] ${mode.tile}`}
                        >
                          <mode.icon aria-hidden className="size-7" />
                        </span>
                        <ArrowUpRight
                          aria-hidden
                          className="text-brand size-6 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                        />
                      </span>
                      <span className="mt-5 font-[family-name:var(--font-display)] text-2xl font-bold">
                        {mode.name}
                      </span>
                      <span className="text-muted mt-1 flex-1 text-base leading-6">
                        {mode.copy}
                      </span>
                      <span className="border-line bg-surface-2 text-muted mt-4 w-fit rounded-full border-2 px-3 py-1 text-[10px] font-black tracking-wider">
                        {mode.preview}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <Reveal>
              <span className="micro-label text-brand">The receipts / built on MagicBlock</span>
              <h2 className="mt-4 max-w-2xl text-4xl sm:text-6xl">The machine runs on chain.</h2>
              <p className="text-muted mt-5 max-w-2xl text-lg">
                Privacy, randomness and a clock you can verify. No trust in the house required.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {receipts.map(([number, title, copy]) => (
                <article key={number} className="gcard flex min-h-44 flex-col p-5">
                  <span className="bg-primary grid size-10 place-items-center rounded-2xl font-mono text-sm font-bold text-white">
                    {number}
                  </span>
                  <h3 className="mt-5 text-lg">{title}</h3>
                  <p className="text-muted mt-2 text-sm leading-6">{copy}</p>
                </article>
              ))}
            </div>
            <Link
              href="/proof"
              prefetch={false}
              className={buttonStyles({ variant: "outline", className: "mt-8" })}
            >
              Check the proof <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </section>
          <section className="cta-sky border-t-4 border-[#0f1f5c]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-12 sm:px-8">
              <div>
                <span className="sun-text font-mono text-xs font-bold uppercase">
                  The machine is ready
                </span>
                <h2 className="mt-2 text-3xl sm:text-5xl">Take your seat.</h2>
              </div>
              <PlayButton />
            </div>
          </section>
        </main>
      </LandingMotion>
    </PageTransition>
  );
}
