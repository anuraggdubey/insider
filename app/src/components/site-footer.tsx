import { ArrowUpRight, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const PROGRAM =
  process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID || "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
const TABLE = "DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k";
const REPO = "https://github.com/anuraggdubey/insider";
const DEMO = process.env.NEXT_PUBLIC_DEMO_URL || "";
const explorer = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;

type FooterLink = { label: string; href: string; external?: boolean; note?: string };

const play: FooterLink[] = [
  { label: "The Floor", href: "/table" },
  { label: "The Desk", href: "/desk" },
  { label: "Alpha Cup", href: "/cup" },
  { label: "Season", href: "/season" },
  { label: "X-ray replays", href: "/xray" },
  { label: "Watch live", href: "/watch" },
  { label: "How to play", href: "/rules" },
];
const build: FooterLink[] = [
  { label: "Proof of live runs", href: "/proof" },
  { label: "Docs", href: `${REPO}/tree/main/docs`, external: true },
  { label: "SDK guide", href: `${REPO}/blob/main/docs/api.md`, external: true },
  { label: "Source on GitHub", href: REPO, external: true },
  { label: "Runbook", href: `${REPO}/blob/main/docs/runbook.md`, external: true },
];
const chain: FooterLink[] = [
  { label: "Explorer: program", href: explorer(PROGRAM), external: true },
  { label: "Explorer: live table", href: explorer(TABLE), external: true },
  { label: "MagicBlock", href: "https://www.magicblock.xyz", external: true },
  { label: "MagicBlock docs", href: "https://docs.magicblock.gg", external: true },
  { label: "Solana", href: "https://solana.com", external: true },
];

function Column({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold tracking-wide text-white/50 uppercase">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => {
          const body = (
            <>
              {link.label}
              {link.external && <ArrowUpRight aria-hidden className="size-3.5 opacity-60" />}
              {link.note && (
                <span className="text-[11px] font-normal text-white/40">{link.note}</span>
              )}
            </>
          );
          const cls =
            "inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition-colors hover:text-white";
          return (
            <li key={link.label}>
              {link.external ? (
                <a href={link.href} target="_blank" rel="noreferrer" className={cls}>
                  {body}
                </a>
              ) : (
                <Link href={link.href} prefetch={false} className={cls}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-[#1a0f2e] text-white">
      <div className="bg-brand/30 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 pt-14 pb-4 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <Logo invert size="lg" />
            <p className="mt-5 max-w-sm text-lg leading-7 font-bold text-white/90">
              A multiplayer game of hidden information. Own the secret.
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">
              Play-money chips on Solana devnet. Moves wait in a sealed MagicBlock rollup; nobody
              can read them, not even us.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {DEMO ? (
                <a href={DEMO} target="_blank" rel="noreferrer" className="btn h-11 px-5 text-base">
                  <Play aria-hidden className="size-4 fill-current" /> Watch the teaser
                </a>
              ) : (
                <span className="inline-flex h-11 items-center gap-2 rounded-2xl border border-dashed border-white/30 px-5 font-[family-name:var(--font-display)] text-base font-bold text-white/60">
                  <Play aria-hidden className="size-4" /> Demo video · soon
                </span>
              )}
              <a
                href={REPO}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/25 bg-white/5 px-5 font-[family-name:var(--font-display)] text-base font-bold text-white transition-colors hover:bg-white/10"
              >
                Star the repo <ArrowUpRight aria-hidden className="size-4" />
              </a>
            </div>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            <Column title="Play" links={play} />
            <Column title="Build" links={build} />
            <Column title="On-chain" links={chain} />
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-white/10 pt-6 text-xs font-semibold text-white/55">
          <span>Built for Solana Blitz v10 · Devnet only · no real funds</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              className="underline-offset-4 hover:text-white hover:underline"
              href="https://x.com/ANURAGGDUBEYY"
              target="_blank"
              rel="noreferrer"
            >
              X @anuraggdubeyy
            </a>
            <a
              className="underline-offset-4 hover:text-white hover:underline"
              href="https://github.com/anuraggdubey"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none relative mt-2 select-none">
        <Image
          src="/art/footer-row.jpg"
          alt=""
          width={1920}
          height={150}
          sizes="100vw"
          className="block h-auto min-h-[84px] w-full object-cover object-top"
        />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#1a0f2e] to-transparent" />
      </div>
    </footer>
  );
}
