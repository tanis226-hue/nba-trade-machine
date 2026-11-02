import type { Metadata } from "next";
import Link from "next/link";
import { Big_Shoulders, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AdSlot } from "@/components/AdSlot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthControls } from "@/components/AuthControls";
import { authEnabled } from "@/lib/auth";

// Apply the saved theme before paint (no flash). Light is the default; dark only when chosen.
const themeScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

const display = Big_Shoulders({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--ff-display",adjustFontFallback:false,fallback:['Arial Narrow','sans-serif'] });
const body = Bricolage_Grotesque({ subsets: ["latin"], variable: "--ff-body" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ff-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://nbatm.zldagroup.com"),
  title: "NBA Trade Machine - Build and Explore Multi-Team Deals",
  description:
    "Build 2-7 team NBA trades, explore cap consequences, and understand salary-matching and apron checks with cited rule explanations.",
  openGraph: {
    title: "NBA Trade Machine",
    description: "Explore multi-team NBA trades and understand the cap consequences.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NBA Trade Machine",
    description: "Explore multi-team NBA trades and understand the cap consequences.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Ad slots stay reserved (CLS-safe) but render nothing until a real ad network is wired
  // (monetization is the last milestone). Flip NEXT_PUBLIC_ADS_ENABLED=true to show them.
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
  const tree = (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--bg)]/80 backdrop-blur-md">
          <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
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
                <span className="mt-1 text-[11px] text-[var(--muted)]">
                  Built for NBA fans
                </span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <nav aria-label="Main navigation" className="hidden items-center gap-6 pr-5 text-sm font-semibold sm:flex">
                <Link href="/" className="hover:text-[var(--accent)]">Trade builder</Link>
                <Link href="/#how-it-works" className="text-[var(--muted)] hover:text-[var(--accent)]">How it works</Link>
              </nav>
              <ThemeToggle />
              {authEnabled && <AuthControls />}
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1400px] flex-1 justify-center gap-6 px-4 sm:px-6">
          {adsEnabled && (
            <aside className="hidden shrink-0 pt-8 2xl:block">
              <div className="sticky top-24">
                <AdSlot size="tower" />
              </div>
            </aside>
          )}
          <div id="main-content" tabIndex={-1} className={`w-full min-w-0 pt-8 outline-none ${adsEnabled ? "pb-28" : "pb-12"}`}>{children}</div>
          {adsEnabled && (
            <aside className="hidden shrink-0 pt-8 2xl:block">
              <div className="sticky top-24">
                <AdSlot size="tower" />
              </div>
            </aside>
          )}
        </div>

        <footer className="flex flex-col items-center gap-1 border-t border-[var(--border-soft)] py-6">
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
          <p className="px-4 text-center text-xs text-[var(--muted)]">
            Public salary data · Fan simulation · Not affiliated with the NBA
          </p>
        </footer>
        {/* Traffic analytics handled by Netlify Analytics (server-side, dashboard-enabled);
            no client script needed. Swap in Plausible here if event tracking is wanted. */}
      </body>
    </html>
  );

  // Only mount ClerkProvider when auth is configured, so the app runs unchanged (local-only) when
  // no Clerk keys are present.
  return authEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}
