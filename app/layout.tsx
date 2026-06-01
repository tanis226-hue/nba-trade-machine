import type { Metadata } from "next";
import { Oswald, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AdSlot } from "@/components/AdSlot";

const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-oswald" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "NBA Trade Machine",
  description: "A fast, accurate multi-team NBA trade simulator with live luxury-tax and apron validation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${oswald.variable} ${hanken.variable} ${plexMono.variable} antialiased`}>
      <body>
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--bg)]/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent)] font-display text-lg font-bold text-black shadow-[0_0_24px_-4px_var(--accent)]">
              ⛹
            </div>
            <div className="font-display text-lg font-bold uppercase tracking-[0.14em] text-[var(--text)]">
              Trade Machine
            </div>
            <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              NBA
            </span>
            <div className="ml-auto hidden text-xs text-[var(--faint)] sm:block">2025-26 CBA · Apron-aware</div>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1500px] justify-center gap-6 px-4">
          <aside className="hidden shrink-0 pt-6 2xl:block">
            <div className="sticky top-20">
              <AdSlot size="tower" />
            </div>
          </aside>
          <div className="w-full min-w-0 max-w-5xl pb-24 pt-6">{children}</div>
          <aside className="hidden shrink-0 pt-6 2xl:block">
            <div className="sticky top-20">
              <AdSlot size="tower" />
            </div>
          </aside>
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-20 flex justify-center border-t border-[var(--border-soft)] bg-[var(--bg-elev)]/90 py-1.5 backdrop-blur">
          <div className="md:hidden">
            <AdSlot size="footer-mobile" />
          </div>
          <div className="hidden md:block">
            <AdSlot size="footer-desktop" />
          </div>
        </footer>
      </body>
    </html>
  );
}
