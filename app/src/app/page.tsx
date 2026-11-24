import { ArrowRight, Eye, Sparkles, Swords, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PlayButton } from "@/components/onboarding/play-button";
import { FastModeToggle, WalletPlayButton } from "@/components/onboarding/wallet";
import { HorizontalRounds, Marquee, Parallax, Reveal } from "@/components/landing/motion";
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
    icon: Swords,
    name: "The Arena",
    text: "The core round: hidden moves, Leaks, front-running and the replay.",
    href: "/table",
    tint: "bg-sun/25 text-[#8a5a00]",
  },
  {
    icon: Eye,
    name: "The Desk",
    text: "Call the real SOL price up or down, sealed. Sell a read. Get judged by the oracle.",
    href: "/desk",
    tint: "bg-sealed/10 text-sealed",
  },
  {
    icon: Trophy,
    name: "Alpha Cup",
    text: "A five-round tournament for human players, with a prize pool.",
    href: "/cup",
    tint: "bg-pop/10 text-pop",
  },
  {
    icon: Sparkles,
    name: "Proof",
    text: "Every claim on this site, with the real devnet transaction behind it.",
    href: "/proof",
    tint: "bg-brand/10 text-brand",
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
      <section className="relative mx-auto max-w-7xl px-5 pt-14 pb-16 sm:px-8 lg:pt-20 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_.98fr]">
          <div className="pop-in max-w-2xl">
            <span className="text-brand bg-brand/10 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold tracking-wide uppercase">
              <span className="bg-brand size-1.5 rounded-full" /> A multiplayer game of secrets
            </span>
            <h1 className="mt-6 text-[clamp(3rem,7.4vw,5.9rem)] leading-[.95] font-extrabold tracking-[-0.035em]">
              Own the
              <br />
              <span className="hl">secret.</span>
            </h1>
            <p className="text-muted mt-7 max-w-lg text-lg leading-8 font-semibold">
              Everyone trades on a hidden market. Your moves wait in the dark, Leaks drop as sealed
              capsules, and you win the round by knowing what the others can&apos;t.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
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
            <Parallax className="relative w-full max-w-[580px]">
              <div className="from-brand/25 to-sun/30 absolute -inset-6 -z-10 rounded-[48px] bg-gradient-to-br blur-3xl" />
              <div className="gcard overflow-hidden !rounded-[32px] p-2">
                <Image
                  src="/art/hero.jpg"
                  alt="A capsule split open: the lid on the right, and a rival's buy order for 1,200 floating above it"
                  width={1600}
                  height={900}
                  priority
                  sizes="(min-width: 1024px) 580px, 92vw"
                  className="aspect-[5/4] w-full rounded-[24px] object-cover object-[46%_50%]"
                />
              </div>
              <span className="glass text-ink absolute top-6 -left-3 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-bold sm:-left-6">
                <span className="bg-brand size-2 rounded-full" /> Only you can read it
              </span>
              <span className="glass text-ink bob absolute -right-2 -bottom-5 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-bold sm:-right-6">
                <span className="bg-buy size-2 rounded-full" /> Silver Fox just bought 1,200
              </span>
            </Parallax>
          </div>
        </div>

        <Reveal className="mt-16">
          <dl className="gcard grid grid-cols-2 gap-px overflow-hidden !bg-[var(--color-line)] lg:grid-cols-4">
            {facts.map(([value, label]) => (
              <div key={label} className="bg-surface px-6 py-5">
                <dt className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">
                  {value}
                </dt>
                <dd className="text-muted mt-1 text-sm font-semibold">{label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <Marquee
        items={[
          "Sealed moves",
          "Leaks",
          "Front-running",
          "X-ray replay",
          "VRF-rolled rounds",
          "Private rollup",
          "Play money",
        ]}
      />

      <HorizontalRounds rounds={rounds} />

      {/* the table */}
      <section className="mx-auto max-w-7xl px-5 pt-16 sm:px-8 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr]">
          <Reveal>
            <div className="gcard overflow-hidden !rounded-[32px] p-2">
              <Image
                src="/art/pyramid.jpg"
                alt="Ten capsules stacked in a pyramid, one colour per seat"
                width={1600}
                height={900}
                sizes="(min-width: 1024px) 560px, 92vw"
                className="aspect-[5/4] w-full rounded-[24px] object-cover object-[50%_42%]"
              />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div>
              <span className="micro-label text-brand">Ten seats. One table.</span>
              <h2 className="mt-3 text-4xl sm:text-5xl">Everyone is hiding something.</h2>
              <p className="text-muted mt-5 max-w-xl text-lg leading-8 font-semibold">
                Bots front-run you, bait you and flip your leaks. Two AI analysts call the real SOL
                price in public. The table is never empty, and nobody, not even us, can read a move
                until it lands.
              </p>
              <ul className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
                {[
                  ["Front-runner", "Reads your order, gets there first"],
                  ["Baiter", "Sends decoys, watches you bite"],
                  ["Flipper", "Never opens it. Sells it higher"],
                  ["Analysts", "Call SOL up or down in public"],
                ].map(([name, text]) => (
                  <li key={name} className="border-line bg-surface rounded-2xl border px-4 py-3.5">
                    <span className="block font-[family-name:var(--font-display)] text-base font-bold">
                      {name}
                    </span>
                    <span className="text-muted text-sm font-semibold">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* game modes */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="micro-label text-brand">Pick your table</span>
            <h2 className="mt-3 text-4xl sm:text-5xl">Game modes</h2>
          </div>
          <Link
            href="/proof"
            prefetch={false}
            className="text-brand inline-flex items-center gap-1.5 text-sm font-extrabold hover:underline"
          >
            See the proof <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map(({ icon: Icon, name, text, href, tint }, i) => (
            <Reveal key={name} delay={i * 0.08}>
              <Link href={href} prefetch={false} className="gcard group flex h-full flex-col p-6">
                <span className={`${tint} flex size-12 items-center justify-center rounded-2xl`}>
                  <Icon className="size-5" strokeWidth={2.4} />
                </span>
                <h3 className="mt-5 text-xl">{name}</h3>
                <p className="text-muted mt-2 flex-1 text-sm leading-6 font-semibold">{text}</p>
                <span className="text-brand mt-5 inline-flex items-center gap-1 text-sm font-extrabold">
                  Open
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* on-chain strip */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-[#1a1438] px-7 py-12 text-white sm:px-12">
            <div className="bg-brand/40 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-3xl text-white sm:text-4xl">Real game. Real chain.</h2>
                <p className="mt-3 max-w-xl text-base leading-7 font-semibold text-white/75">
                  The whole round runs inside a MagicBlock Private Ephemeral Rollup: a sealed
                  mempool, VRF-rolled rounds, cranks that keep the clock, and permissions that
                  decide who can read what. Nothing here uses real money.
                </p>
              </div>
              <Link
                href="/proof"
                prefetch={false}
                className={buttonStyles({ variant: "primary", size: "lg" })}
              >
                Explore the proof
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
