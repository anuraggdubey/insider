import type { Metadata, Viewport } from "next";
import { Varela_Round, Lilita_One } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Toaster } from "@/components/ui/toast";
import { SoundButton } from "@/components/ui/sound-button";
import { WalletButton } from "@/components/ui/wallet-button";
import { Providers } from "./providers";
import "./globals.css";

const bodyFont = Varela_Round({ variable: "--font-body", weight: "400", subsets: ["latin"] });
const displayFont = Lilita_One({ variable: "--font-lilita", weight: "400", subsets: ["latin"] });

const description = "Orders wait in a TEE-sealed dark mempool. Buy a look. Jump the line.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  applicationName: "INSIDER",
  title: { default: "INSIDER — Front-running is the game.", template: "%s" },
  description,
  openGraph: {
    type: "website",
    siteName: "INSIDER",
    title: "INSIDER — Front-running is the game.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "INSIDER — Front-running is the game.",
    description,
  },
};
export const viewport: Viewport = { themeColor: "#bfe3ff" };

const nav = [
  ["Floor", "/table"],
  ["X-ray", "/xray"],
  ["Season", "/season"],
  ["Rules", "/rules"],
  ["Watch", "/watch"],
  ["Desk", "/desk"],
  ["Cup", "/cup"],
  ["Proof", "/proof"],
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <header className="border-ink relative z-20 border-b-[3px] bg-white/85 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-8 md:gap-5">
              <Link
                href="/"
                className="text-ink flex shrink-0 items-center gap-2 font-[family-name:var(--font-lilita)] text-lg tracking-[.06em] md:mr-1"
              >
                <span className="border-ink bg-sun text-ink flex size-7 items-center justify-center rounded-lg border-[3px] text-sm shadow-[0_3px_0_var(--color-ink)]">
                  I
                </span>
                INSIDER
              </Link>
              <MobileNav items={nav} />
              <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
                {nav.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    className="text-muted hover:bg-surface-2 hover:text-ink rounded-lg px-2.5 py-1.5 text-sm font-bold transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <SoundButton />
                <WalletButton />
              </div>
            </div>
          </header>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
