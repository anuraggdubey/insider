import type { Metadata, Viewport } from "next";
import { Nunito, Outfit } from "next/font/google";
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

const bodyFont = Nunito({ variable: "--font-body", subsets: ["latin"] });
const displayFont = Outfit({ variable: "--font-display", subsets: ["latin"] });

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
export const viewport: Viewport = { themeColor: "#f5f6fb" };

// Five links in the bar; everything else lives in the footer.
const nav = [
  ["Floor", "/table"],
  ["Desk", "/desk"],
  ["Cup", "/cup"],
  ["Season", "/season"],
  ["Proof", "/proof"],
];

const THEME_SCRIPT = `try{var t=localStorage.getItem("insider.theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
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
          <header className="border-line bg-surface/75 sticky top-0 z-30 border-b backdrop-blur-xl">
            <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-2 px-4 sm:px-8 md:gap-5">
              <Logo />
              <MobileNav items={nav} />
              <MainNav items={nav} />
              <div className="ml-auto flex items-center gap-3">
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
