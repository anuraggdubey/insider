import { Eye, Sparkles, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { PlayButton } from "@/components/onboarding/play-button";
import { FastModeToggle, WalletPlayButton } from "@/components/onboarding/wallet";
import { buttonStyles } from "@/components/ui/button";
import { SealedCard } from "@/components/ui/sealed-card";

const rounds = [
  {
    tag: "01 · DROP IN",
    title: "Take a seat",
    text: "One click and you are at the table with nine rivals: bots, AI players and other people. Chips are play money. A round is about 100 seconds.",
    tone: "sun",
  },
  {
    tag: "02 · THE SECRET",
    title: "Move in the dark",
    text: "Every move you make hides for 10 seconds where nobody can read it. A hidden future, rolled by on-chain randomness, decides where the round goes.",
    tone: "sky",
  },
  {
    tag: "03 · GRAB A LEAK",
    title: "Pop a capsule",
    text: "Every ten seconds a sealed Leak drops. Win it in a falling-price auction and you become its only reader: a peek at what rivals queued, or a fact about the future.",
    tone: "pop",
  },
  {
    tag: "04 · CASH IT IN",
    title: "Play your read",
    text: "Jump ahead of the moves you just saw, flip the capsule sealed to a rival who'll pay more, or licence it and watch its value fade. Then the X-ray shows everyone's hand.",
    tone: "mint",
  },
];

const modes = [
  {
    icon: Swords,
    name: "The Arena",
    text: "The core round: hidden moves, Leaks, front-running and the replay.",
    href: "/table",
  },
  {
    icon: Eye,
    name: "The Desk",
    text: "Call the real SOL price up or down, sealed. Sell a read. Get judged by the oracle.",
    href: "/desk",
  },
  {
    icon: Trophy,
    name: "Alpha Cup",
    text: "A five-round tournament for human players, with a prize pool.",
    href: "/cup",
  },
  {
    icon: Sparkles,
    name: "Proof",
    text: "Every claim on this site, with the real devnet transaction behind it.",
    href: "/proof",
  },
];

const toneBg: Record<string, string> = {
  sun: "bg-sun",
  sky: "bg-sealed",
  pop: "bg-pop",
  mint: "bg-mint",
};

export default function Home() {
  return (
    <main className="flex-1 overflow-hidden">
      {/* hero */}
      <section className="relative mx-auto max-w-7xl px-5 pt-16 pb-20 sm:px-8 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <span className="confetti bg-pop left-[12%] [animation-delay:0s]" />
          <span className="confetti bg-sun left-[28%] [animation-delay:1.4s]" />
          <span className="confetti bg-sealed left-[62%] [animation-delay:.7s]" />
          <span className="confetti bg-mint left-[80%] [animation-delay:2.1s]" />
          <span className="confetti bg-epic left-[46%] [animation-delay:3s]" />
        </div>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div className="pop-in max-w-2xl">
            <span className="border-ink text-ink inline-flex items-center gap-2 rounded-full border-2 bg-white px-3 py-1 text-xs font-bold tracking-wide uppercase shadow-[0_3px_0_var(--color-ink)]">
              <span className="bg-pop size-2 rounded-full" /> A multiplayer game of secrets
            </span>
            <h1 className="mt-6 text-[clamp(3.2rem,8vw,6.5rem)] leading-[.92] tracking-tight">
              <span className="title-pop">OWN THE</span>
              <br />
              <span className="title-pop title-pop-alt">SECRET.</span>
            </h1>
            <p className="text-ink/80 mt-7 max-w-lg text-lg leading-7 font-medium">
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
            <p className="text-muted mt-8 text-xs font-bold tracking-wide uppercase">
              Solana devnet · MagicBlock Private Rollup · play-money chips, no real funds
            </p>
          </div>

          <div className="pop-in flex justify-center [animation-delay:.15s]">
            <div className="relative w-full max-w-[380px]">
              <div className="rotate-[-5deg]">
                <SealedCard kind="Spotlight" rarity="rare" state="sealed" price={20} />
              </div>
              <div className="absolute -right-2 -bottom-6 w-44 rotate-[7deg]">
                <SealedCard kind="Whale tip" rarity="epic" state="opened" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how a round plays */}
      <section className="border-ink border-y-[3px] bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mb-10 text-center">
            <span className="micro-label text-pop">Everyone drops in. One winner.</span>
            <h2 className="mt-3 text-4xl sm:text-5xl">How a round plays</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {rounds.map((r) => (
              <article key={r.tag} className="toy flex flex-col p-5">
                <span
                  className={`${toneBg[r.tone]} border-ink inline-flex w-fit rounded-full border-2 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase`}
                >
                  {r.tag}
                </span>
                <h3 className="mt-4 text-xl">{r.title}</h3>
                <p className="text-ink/75 mt-2 text-sm leading-6 font-medium">{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* game modes */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="micro-label text-pop">Pick your table</span>
            <h2 className="mt-3 text-4xl">Game modes</h2>
          </div>
          <Link
            href="/proof"
            prefetch={false}
            className="text-ink hover:text-pop text-sm font-bold underline-offset-4 hover:underline"
          >
            See the proof →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modes.map(({ icon: Icon, name, text, href }) => (
            <Link
              key={name}
              href={href}
              prefetch={false}
              className="toy group flex flex-col p-5 transition-transform duration-150 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1"
            >
              <span className="border-ink bg-sun text-ink flex size-12 items-center justify-center rounded-xl border-[3px] shadow-[0_3px_0_var(--color-ink)]">
                <Icon className="size-5" strokeWidth={2.4} />
              </span>
              <h3 className="mt-5 text-xl">{name}</h3>
              <p className="text-ink/75 mt-2 text-sm leading-6 font-medium">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* on-chain strip */}
      <section className="border-ink bg-ink border-t-[3px]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-white">
            <h2 className="text-3xl text-white">Real game. Real chain.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 font-medium text-white/70">
              The whole round runs inside a MagicBlock Private Ephemeral Rollup: a sealed mempool,
              VRF-rolled rounds, cranks that keep the clock, and permissions that decide who can
              read what. Nothing here uses real money.
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
      </section>

      <footer className="border-ink border-t-[3px]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8">
          <div className="text-ink font-[family-name:var(--font-lilita)] tracking-wide">
            INSIDER{" "}
            <span className="text-muted ml-2 text-xs font-normal">Built for Solana Blitz v10</span>
          </div>
          <a
            href="https://github.com/anuraggdubey/insider"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-ink text-xs font-bold tracking-wide uppercase"
          >
            View source ↗
          </a>
        </div>
      </footer>
    </main>
  );
}
