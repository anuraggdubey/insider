import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
    href: "/table",
    copy: "Trade hidden moves and win the information game.",
    preview: "10 SEATS / 2 LANES",
  },
  {
    name: "The Desk",
    href: "/desk",
    copy: "Make a sealed Call on the real SOL price.",
    preview: "SOL / UP OR DOWN",
  },
  {
    name: "Alpha Cup",
    href: "/cup",
    copy: "Five rounds. Human seats. One prize pool.",
    preview: "5 ROUNDS / TOP 3",
  },
  {
    name: "Season",
    href: "/season",
    copy: "One good read can put you on the board.",
    preview: "HIGH SCORES / LIVE",
  },
  {
    name: "Watch",
    href: "/watch",
    copy: "See the public action unfold in real time.",
    preview: "BROADCAST / LIVE",
  },
  {
    name: "X-ray",
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
                <span className="micro-label text-sealed">A game of hidden information / 01</span>
                <h1 className="mt-6 max-w-3xl text-[clamp(3.4rem,7vw,6.5rem)] leading-[0.9] font-black tracking-[-0.04em]">
                  Front-running is the <span className="hl">game.</span>
                </h1>
                <p className="text-muted mt-7 max-w-lg text-lg leading-7">
                  Orders wait 10 seconds in a sealed mempool. Buy a capsule to peek. Jump the line.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <PlayButton />
                  <WalletPlayButton size="lg" />
                </div>
                <p className="text-faint mt-6 font-mono text-[10px] leading-5 uppercase">
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
          <section aria-label="The game at a glance" className="border-line bg-surface border-y">
            <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
              {[
                ["90 s", "80s LIVE / 10s CLOSING"],
                ["10 s", "X-RAY AFTER THE BELL"],
                ["500 ms", "PER TICK"],
                ["10 / 0", "SEATS / SOL TO PLAY"],
              ].map(([value, label]) => (
                <div key={value} className="border-line p-5 sm:p-7">
                  <div className="text-3xl font-black tracking-tight">{value}</div>
                  <div className="micro-label mt-2">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <ScrollBand top="HIDDEN MOVES" bottom="SEALED SECRETS" />
          <HorizontalRounds rounds={rounds} />
          <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-28">
            <Reveal>
              <div>
                <span className="micro-label text-sealed">The table / 10 seats</span>
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
              <div className="gcard p-5 sm:p-8">
                <div className="micro-label mb-6">Player tokens / 10 occupied seats</div>
                <div className="grid grid-cols-5 gap-3">
                  {["B", "B", "B", "B", "B", "AI", "AI", "YOU", "H", "H"].map((seat, index) => (
                    <div key={index} className="text-center">
                      <div
                        className={`mx-auto grid aspect-square w-full max-w-16 place-items-center rounded-full border-2 font-mono text-xs font-bold ${seat === "YOU" ? "border-you bg-you text-white" : "border-ink bg-surface-2 text-ink"}`}
                      >
                        {seat}
                      </div>
                      <span className="text-faint mt-2 block font-mono text-[9px]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-muted mt-6 font-mono text-[10px] uppercase">
                  05 Bots / 02 AI / 03 Human
                </p>
              </div>
            </ScaleIn>
          </section>
          <section className="border-line bg-surface border-y">
            <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
              <span className="micro-label text-sealed">Pick a channel</span>
              <h2 className="mt-4 text-4xl sm:text-6xl">Game modes.</h2>
              <ul className="border-line mt-10 border-t">
                {modes.map((mode, index) => (
                  <li key={mode.name} className="border-line border-b">
                    <Link
                      href={mode.href}
                      prefetch={false}
                      className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-6 sm:grid-cols-[4rem_1fr_1fr_auto]"
                    >
                      <span className="text-faint font-mono text-xs">0{index + 1} /</span>
                      <span className="text-xl font-extrabold sm:text-2xl">{mode.name}</span>
                      <span className="text-muted hidden text-sm sm:block">{mode.copy}</span>
                      <span className="flex items-center gap-3">
                        <span className="border-line-strong bg-surface-2 text-muted hidden rounded border px-2 py-1 font-mono text-[9px] group-hover:block group-focus-visible:block lg:block">
                          {mode.preview}
                        </span>
                        <ArrowUpRight aria-hidden className="size-5" />
                      </span>
                      <span className="text-muted col-start-2 col-end-4 text-sm sm:hidden">
                        {mode.copy}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <Reveal>
              <span className="micro-label text-sealed">The receipts / built on MagicBlock</span>
              <h2 className="mt-4 max-w-2xl text-4xl sm:text-6xl">The machine runs on chain.</h2>
              <p className="text-muted mt-5 max-w-2xl text-lg">
                Privacy, randomness and a clock you can verify. No trust in the house required.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {receipts.map(([number, title, copy]) => (
                <article key={number} className="gcard flex min-h-44 flex-col p-5">
                  <span className="text-sealed font-mono text-xs">{number} / VERIFIED</span>
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
          <section className="bg-capsule text-[#161513]">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-5 py-12 sm:px-8">
              <div>
                <span className="font-mono text-xs font-bold uppercase">The machine is ready</span>
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
