import type { Metadata } from "next";
import Link from "next/link";
import { Big_Shoulders, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdSlot } from "@/components/AdSlot";
import { ThemeToggle } from "@/components/ThemeToggle";

// Apply the saved theme before paint (no flash). Light is the default; dark only when chosen.
const themeScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

const display = Big_Shoulders({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--ff-display" });
const body = Bricolage_Grotesque({ subsets: ["latin"], variable: "--ff-body" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ff-mono" });

export const metadata: Metadata = {
  // TODO: set to the real deployed origin before launch.
  metadataBase: new URL("https://nbatrademachine.app"),
  title: "NBA Trade Machine - Accurate Multi-Team Trade Simulator",
  description:
    "Build 2-7 team NBA trades with real current contracts and exact 2023-CBA salary-matching, luxury-tax, and first/second-apron validation. Fast, correct, shareable.",
  openGraph: {
    title: "NBA Trade Machine",
    description: "Accurate, current multi-team NBA trade simulator.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NBA Trade Machine",
    description: "Accurate, current multi-team NBA trade simulator.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Ad slots stay reserved (CLS-safe) but render nothing until a real ad network is wired
  // (monetization is the last milestone). Flip NEXT_PUBLIC_ADS_ENABLED=true to show them.
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="grain" aria-hidden />
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--bg)]/80 backdrop-blur-md">
          <div className="accent-rule" />
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-3">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[4px] bg-[var(--accent)] shadow-[0_6px_20px_-6px_var(--accent)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="var(--ink)" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18M3 12h18M5.5 5.5c3 2.2 3 10.8 0 13M18.5 5.5c-3 2.2-3 10.8 0 13" />
                </svg>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-[22px] font-bold uppercase leading-[0.85] tracking-[0.02em] text-[var(--text)]">
                  Trade Machine
                </span>
                <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.34em] text-[var(--faint)]">
                  NBA · Cap & CBA Engine
                </span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--faint)] lg:block">
                2026-27 · 2023 CBA
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] sm:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--legal)] opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--legal)]" />
                </span>
                Apron-aware
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1500px] justify-center gap-6 px-4 sm:px-6">
          {adsEnabled && (
            <aside className="hidden shrink-0 pt-8 2xl:block">
              <div className="sticky top-24">
                <AdSlot size="tower" />
              </div>
            </aside>
          )}
          <div className={`w-full min-w-0 max-w-5xl pt-8 ${adsEnabled ? "pb-28" : "pb-16"}`}>{children}</div>
          {adsEnabled && (
            <aside className="hidden shrink-0 pt-8 2xl:block">
              <div className="sticky top-24">
                <AdSlot size="tower" />
              </div>
            </aside>
          )}
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-1 border-t border-[var(--border-soft)] bg-[var(--bg-elev)]/92 py-2 backdrop-blur">
          {adsEnabled && (
            <>
              <div className="md:hidden">
                <AdSlot size="footer-mobile" />
              </div>
              <div className="hidden md:block">
                <AdSlot size="footer-desktop" />
              </div>
            </>
          )}
          <p className="px-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--faint)]">
            Salaries from public data, hand-verified · Not affiliated with the NBA
          </p>
        </footer>
        {/* Traffic analytics handled by Netlify Analytics (server-side, dashboard-enabled);
            no client script needed. Swap in Plausible here if event tracking is wanted. */}
      </body>
    </html>
  );
}
