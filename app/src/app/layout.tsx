import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Toaster } from "@/components/ui/toast";
import { SoundButton } from "@/components/ui/sound-button";
import { WalletButton } from "@/components/ui/wallet-button";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "INSIDER — Front-running is the game.",
  description: "Orders wait in a TEE-sealed dark mempool. Buy a look. Jump the line.",
};
export const viewport: Viewport = { themeColor: "#07080A" };

const nav = [
  ["Floor", "/table"],
  ["X-ray", "/xray"],
  ["Season", "/season"],
  ["Rules", "/rules"],
  ["Watch", "/watch"],
  ["Desk", "/desk"],
  ["Proof", "/proof"],
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <header className="border-line bg-bg/90 relative z-20 border-b">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-8 md:gap-6">
              <Link
                href="/"
                className="text-text flex shrink-0 items-center gap-2.5 font-mono text-sm font-bold tracking-[.18em] md:mr-2"
              >
                <span className="border-sealed text-sealed flex size-5 items-center justify-center border text-[10px]">
                  I
                </span>
                INSIDER
              </Link>
              <MobileNav items={nav} />
              <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
                {nav.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={href === "/desk" || href === "/proof" ? false : undefined}
                    className="text-muted hover:text-text font-mono text-[11px] tracking-wide transition-colors"
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
