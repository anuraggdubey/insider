import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const PROGRAM =
  process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID || "7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW";
const TABLE = "DjnqzKQsUU1fmRztBAiUkPn8VwsnFYgMedcg1BPyA1k";
const REPO = "https://github.com/anuraggdubey/insider";
const DEMO = process.env.NEXT_PUBLIC_DEMO_URL || "";
const explorer = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;

type FooterLink = { label: string; href: string; external?: boolean };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Play",
    links: [
      { label: "The Floor", href: "/table" },
      { label: "The Desk", href: "/desk" },
      { label: "Alpha Cup", href: "/cup" },
      { label: "Season", href: "/season" },
      { label: "X-ray replays", href: "/xray" },
      { label: "How to play", href: "/rules" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "Proof of live runs", href: "/proof" },
      { label: "Docs", href: `${REPO}/tree/main/docs`, external: true },
      { label: "SDK guide", href: `${REPO}/blob/main/docs/api.md`, external: true },
      { label: "Source", href: REPO, external: true },
      ...(DEMO ? [{ label: "Demo video", href: DEMO, external: true }] : []),
    ],
  },
  {
    title: "On-chain",
    links: [
      { label: "Program", href: explorer(PROGRAM), external: true },
      { label: "Live table", href: explorer(TABLE), external: true },
      { label: "MagicBlock", href: "https://www.magicblock.xyz", external: true },
      { label: "Solana", href: "https://solana.com", external: true },
    ],
  },
];

const linkClass =
  "text-muted hover:text-ink inline-flex items-center gap-1 text-sm font-semibold transition-colors";

export function SiteFooter() {
  return (
    <footer className="border-line bg-surface relative mt-auto overflow-hidden border-t-2">
      <div className="mx-auto max-w-7xl px-5 pt-14 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo />
            <p className="text-muted mt-5 max-w-xs text-sm leading-6 font-semibold">
              A multiplayer game of hidden information. Play-money chips on Solana devnet, moves
              sealed inside a MagicBlock rollup.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map(({ title, links }) => (
              <div key={title}>
                <h3 className="micro-label">{title}</h3>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                          {link.label}
                          <ArrowUpRight aria-hidden className="size-3.5 opacity-50" />
                        </a>
                      ) : (
                        <Link href={link.href} prefetch={false} className={linkClass}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-line text-faint mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t py-6 text-xs font-semibold">
          <span>Built for Solana Blitz v10 · Devnet only · no real funds</span>
          <span className="flex items-center gap-5">
            <a
              className="hover:text-ink transition-colors"
              href="https://x.com/ANURAGGDUBEYY"
              target="_blank"
              rel="noreferrer"
            >
              X @anuraggdubeyy
            </a>
            <a
              className="hover:text-ink transition-colors"
              href="https://github.com/anuraggdubey"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </span>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="text-ink/[0.06] pointer-events-none -mb-[0.2em] text-center font-[family-name:var(--font-display)] text-[clamp(4rem,19vw,17rem)] leading-[.85] font-extrabold tracking-[-0.04em] select-none before:content-['INSIDER']"
      />
    </footer>
  );
}
