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
import { CapsuleArt } from "@/components/ui/capsule-art";
import { CapsulePyramid } from "@/components/ui/capsule-pyramid";
import { PageGuide } from "@/components/ui/page-guide";
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
    tile: "bg-[#2f6bff] text-[#fff]",
    href: "/table",
    copy: "Trade hidden moves and win the information game.",
    preview: "10 SEATS / 2 LANES",
  },
  {
    name: "The Desk",
    icon: Target,
    tile: "bg-[#2fc073] text-[#fff]",
    href: "/desk",
    copy: "Make a sealed Call on the real SOL price.",
    preview: "SOL / UP OR DOWN",
  },
  {
    name: "Alpha Cup",
    icon: Trophy,
    tile: "bg-[#ffc52e] text-[#0d1633]",
    href: "/cup",
    copy: "Five rounds. Human seats. One prize pool.",
    preview: "5 ROUNDS / TOP 3",
  },
  {
    name: "Season",
    icon: Medal,
    tile: "bg-[#7448f5] text-[#fff]",
    href: "/season",
    copy: "One good read can put you on the board.",
    preview: "HIGH SCORES / LIVE",
  },
  {
    name: "Watch",
    icon: Radio,
    tile: "bg-[#f5404a] text-[#fff]",
    href: "/watch",
    copy: "See the public action unfold in real time.",
    preview: "BROADCAST / LIVE",
  },
  {
    name: "X-ray",
    icon: ScanEye,
    tile: "bg-[#25b8d1] text-[#0d1633]",
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
          <section className="mx-auto max-w-7xl px-5 pt-14 pb-16 sm:px-8 lg:pt-20 lg:pb-24">
            <HeroFade className="grid items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <span className="micro-label bg-surface border-primary text-brand inline-block rounded-full border-2 px-3 py-1">
                  A game of hidden information
                </span>
                <h1 className="hero-title mt-6 max-w-3xl text-[clamp(3rem,6vw,5.6rem)] leading-[1.02]">
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
          <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
            <PageGuide
              title="Start playing in 3 steps"
              action={{ label: "Read the 1-minute guide", href: "/rules" }}
              steps={[
                {
                  title: "Press Play as guest",
                  text: "You get a seat and play chips. No wallet, no deposit, nothing to install.",
                },
                {
                  title: "Buy or Sell",
                  text: "Guess where the price goes. End the round with more chips than you started.",
                },
                {
                  title: "Grab a capsule",
                  text: "Buy a secret about what is coming, open it and act first.",
                },
              ]}
            />
          </section>
          <section aria-label="The game at a glance" className="px-5 pb-14 sm:px-8">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ["90 s", "80s live / 10s closing", "#2f6bff"],
                ["10 s", "X-ray after the bell", "#ffc52e"],
                ["500 ms", "per tick", "#25b8d1"],
                ["10", "seats", "#7448f5"],
                ["0 SOL", "to play", "#2fc073"],
              ].map(([value, label, color]) => (
                <div
                  key={value}
                  className="gcard flex flex-col items-center p-4 text-center last:col-span-2 sm:last:col-span-1"
                >
                  <CapsuleArt size={52} color={color} />
                  <div className="mt-2 font-[family-name:var(--font-brand)] text-4xl">{value}</div>
                  <div className="text-muted mt-1 text-[11px] font-black tracking-wider uppercase">
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
                          className={`grid size-14 place-items-center rounded-2xl shadow-[inset_0_2px_0_rgb(255_255_255/0.4),0_10px_16px_-8px_rgb(13_22_51/0.45)] ${mode.tile}`}
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
          <section className="home-cta cta-sky overflow-hidden">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-2">
              <div className="text-center md:text-left">
                <span className="sun-text font-mono text-xs font-bold uppercase">
                  The machine is ready
                </span>
                <h2 className="mt-2 text-4xl sm:text-6xl">Take your seat.</h2>
                <p className="mt-4 text-lg font-bold text-white/85">
                  Ten capsules, ten secrets. One of them can be yours.
                </p>
                <div className="mt-8">
                  <PlayButton />
                </div>
              </div>
              <div className="float-capsule">
                <CapsulePyramid size={86} />
              </div>
            </div>
          </section>
        </main>
      </LandingMotion>
    </PageTransition>
  );
}
