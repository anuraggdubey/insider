import Image from "next/image";
import Link from "next/link";
import {
  HeroFade,
  HorizontalRounds,
  Parallax,
  Reveal,
  ScaleIn,
  ScrollBand,
} from "@/components/landing/motion";
import { PlayButton } from "@/components/onboarding/play-button";
import { FastModeToggle, WalletPlayButton } from "@/components/onboarding/wallet";
import { buttonStyles } from "@/components/ui/button";

const rounds = [
  {
    tag: "01",
    kicker: "Drop in",
    title: "Take a seat",
    text: "One click and you are at the table with nine rivals: bots, AI players and other people. Chips are play money. A round is about 100 seconds.",
    tone: "sun",
    img: "/art/seats.jpg",
    alt: "Ten sealed capsules in a ring, one for every seat",
  },
  {
    tag: "02",
    kicker: "The secret",
    title: "Move in the dark",
    text: "Every move you make hides for 10 seconds where nobody can read it. A hidden future, rolled by on-chain randomness, decides where the round goes.",
    tone: "sky",
    img: "/art/drop.jpg",
    alt: "A buy order dropping into a capsule, sealed before anyone can read it",
  },
  {
    tag: "03",
    kicker: "Grab a leak",
    title: "Pop a capsule",
    text: "Every ten seconds a sealed Leak drops. Win it in a falling-price auction and you become its only reader: a peek at what rivals queued, or a fact about the future.",
    tone: "pop",
    img: "/art/sold.jpg",
    alt: "A mystery capsule next to a flip board that reads SOLD",
  },
  {
    tag: "04",
    kicker: "Cash it in",
    title: "Play your read",
    text: "Jump ahead of the moves you just saw, flip the capsule sealed to a rival who'll pay more, or licence it and watch its value fade. Then the X-ray shows everyone's hand.",
    tone: "mint",
    img: "/art/xray.jpg",
    alt: "X-ray view showing three orders inside their capsules",
  },
];

const modes = [
  {
    name: "The Arena",
    text: "The core round: hidden moves, Leaks, front-running and the replay.",
    href: "/table",
  },
  {
    name: "The Desk",
    text: "Call the real SOL price up or down, sealed. Sell a read. Get judged by the oracle.",
    href: "/desk",
  },
  {
    name: "Alpha Cup",
    text: "A five-round tournament for human players, with a prize pool.",
    href: "/cup",
  },
  {
    name: "Proof",
    text: "Every claim on this site, with the real devnet transaction behind it.",
    href: "/proof",
  },
];

const facts = [
  ["10", "seats per table"],
  ["~100 s", "per round"],
  ["10 s", "every move stays sealed"],
  ["0", "real funds at stake"],
];

export default function Home() {
  return (
    <main className="flex-1 overflow-x-clip">
      {/* hero */}
      <section className="relative mx-auto max-w-7xl px-5 pt-12 pb-14 sm:px-8 lg:pt-16 lg:pb-20">
        <HeroFade className="grid items-center gap-12 lg:grid-cols-[1.02fr_.98fr]">
          <div className="pop-in max-w-2xl">
            <span className="micro-label text-ink border-ink inline-block border px-2.5 py-1">
              A multiplayer game of secrets
            </span>
            <h1 className="mt-6 text-[clamp(3rem,7.4vw,6rem)] leading-[.92] font-extrabold tracking-[-0.045em]">
              Own the
              <br />
              <span className="hl">secret.</span>
            </h1>
            <p className="text-muted mt-6 max-w-lg text-lg leading-7 font-medium">
              Everyone trades on a hidden market. Your moves wait in the dark, Leaks drop as sealed
              capsules, and you win the round by knowing what the others can&apos;t.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PlayButton />
              <WalletPlayButton />
              <Link href="/rules" className={buttonStyles({ variant: "outline", size: "lg" })}>
                How to play
              </Link>
            </div>
            <div className="mt-4">
              <FastModeToggle />
            </div>
          </div>

          <div className="pop-in flex justify-center [animation-delay:.12s]">
            <Parallax className="relative w-full max-w-[560px]">
              <div className="border-line bg-surface overflow-hidden rounded-xl border p-1.5">
                <Image
                  src="/art/hero.jpg"
                  alt="A capsule split open: the lid on the right, and a rival's buy order for 1,200 floating above it"
                  width={1600}
                  height={900}
                  priority
                  sizes="(min-width: 1024px) 560px, 92vw"
                  className="aspect-[5/4] w-full rounded-lg object-cover object-[46%_50%]"
                />
              </div>
              <span className="glass text-ink absolute top-5 -left-3 px-3 py-1.5 text-xs font-bold sm:-left-5">
                Only you can read it
              </span>
              <span className="glass text-ink absolute -right-3 -bottom-4 px-3 py-1.5 text-xs font-bold sm:-right-5">
                Silver Fox just bought 1,200
              </span>
            </Parallax>
          </div>
        </HeroFade>

        <Reveal className="mt-14">
          <dl className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-xl border lg:grid-cols-4">
            {facts.map(([value, label]) => (
              <div key={label} className="bg-surface px-5 py-4">
                <dt className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">
                  {value}
                </dt>
                <dd className="text-muted mt-1 text-sm font-medium">{label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <ScrollBand top="Hidden moves" bottom="Sealed leaks" />

      <HorizontalRounds rounds={rounds} />

      {/* the table */}
      <section className="mx-auto max-w-7xl px-5 pt-16 sm:px-8 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
          <ScaleIn>
            <div className="border-line bg-surface overflow-hidden rounded-xl border p-1.5">
              <Image
                src="/art/pyramid.jpg"
                alt="Ten capsules stacked in a pyramid, one colour per seat"
                width={1600}
                height={900}
                sizes="(min-width: 1024px) 560px, 92vw"
                className="aspect-[5/4] w-full rounded-lg object-cover object-[50%_42%]"
              />
            </div>
          </ScaleIn>
          <Reveal delay={0.12}>
            <div>
              <span className="micro-label text-ink">Ten seats. One table.</span>
              <h2 className="mt-3 text-4xl sm:text-5xl">Everyone is hiding something.</h2>
              <p className="text-muted mt-5 max-w-xl text-lg leading-7 font-medium">
                Bots front-run you, bait you and flip your leaks. Two AI analysts call the real SOL
                price in public. The table is never empty, and nobody, not even us, can read a move
                until it lands.
              </p>
              <dl className="border-line divide-line mt-7 max-w-xl divide-y border-y">
                {[
                  ["Front-runner", "Reads your order, gets there first"],
                  ["Baiter", "Sends decoys, watches you bite"],
                  ["Flipper", "Never opens it. Sells it higher"],
                  ["Analysts", "Call SOL up or down in public"],
                ].map(([name, text]) => (
                  <div key={name} className="flex items-baseline gap-4 py-3">
                    <dt className="w-28 shrink-0 font-[family-name:var(--font-display)] font-bold">
                      {name}
                    </dt>
                    <dd className="text-muted text-sm font-medium">{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      {/* game modes */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="mb-8">
          <span className="micro-label text-ink">Pick your table</span>
          <h2 className="mt-3 text-4xl sm:text-5xl">Game modes</h2>
        </div>
        <ul className="border-line divide-line divide-y border-y">
          {modes.map(({ name, text, href }, i) => (
            <li key={name}>
              <Link
                href={href}
                prefetch={false}
                className="group hover:bg-surface-2 grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 px-2 py-6 transition-colors sm:grid-cols-[3rem_14rem_1fr_auto]"
              >
                <span className="text-faint text-sm font-bold tabular-nums">0{i + 1}</span>
                <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
                  {name}
                </span>
                <span className="text-muted col-start-2 text-sm font-medium sm:col-start-auto">
                  {text}
                </span>
                <span className="text-ink row-start-1 text-lg font-bold transition-transform group-hover:translate-x-1 sm:row-start-auto">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* on-chain */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <ScaleIn>
          <div className="border-ink grid gap-8 border-y-2 py-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl">Real game. Real chain.</h2>
              <p className="text-muted mt-3 max-w-2xl text-base leading-7 font-medium">
                The whole round runs inside a MagicBlock Private Ephemeral Rollup: a sealed mempool,
                VRF-rolled rounds, cranks that keep the clock, and permissions that decide who can
                read what. Nothing here uses real money.
              </p>
            </div>
            <Link
              href="/proof"
              prefetch={false}
              className={buttonStyles({ variant: "outline", size: "lg" })}
            >
              Explore the proof
            </Link>
          </div>
        </ScaleIn>
      </section>
    </main>
  );
}
