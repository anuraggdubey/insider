import type { Metadata, Viewport } from "next";
import { Doto, Fredoka, JetBrains_Mono, Lilita_One, Nunito } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { Logo } from "@/components/ui/logo";
import { MainNav } from "@/components/ui/main-nav";
import { MobileNav } from "@/components/ui/mobile-nav";
import { Toaster } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SoundButton } from "@/components/ui/sound-button";
import { WalletButton } from "@/components/ui/wallet-button";
import { Providers } from "./providers";
import "./globals.css";

const bodyFont = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});
const displayFont = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  display: "swap",
});
const brandFont = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const monoFont = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});
const ledFont = Doto({ variable: "--font-led", subsets: ["latin"], display: "swap" });

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
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4EBFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1430" },
  ],
};

// The main links in the bar; everything else lives in the footer.
const nav = [
  ["How to play", "/rules"],
  ["Floor", "/table"],
  ["Desk", "/desk"],
  ["Cup", "/cup"],
  ["Season", "/season"],
  ["Proof", "/proof"],
];

const THEME_SCRIPT = `try{var t=localStorage.getItem("insider.theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=d?"#0D1430":"#E4EBFB"})}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} ${brandFont.variable} ${monoFont.variable} ${ledFont.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_SCRIPT,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <header
            className="site-header sticky top-0"
            style={{ viewTransitionName: "site-header" }}
          >
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-8 xl:gap-5">
              <Logo />
              <MobileNav items={nav} />
              <MainNav items={nav} />
              <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex xl:gap-3">
                <ThemeToggle />
                <SoundButton />
                <WalletButton />
              </div>
            </div>
          </header>
          {children}
          <SiteFooter />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
