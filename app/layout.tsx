import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AdSlot } from "@/components/AdSlot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA Trade Machine",
  description: "Fast, accurate multi-team NBA trade simulator with live luxury-tax and apron validation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-neutral-50 pb-[60px] text-neutral-900">
        <div className="flex justify-center gap-4">
          <aside className="hidden xl:block">
            <AdSlot size="tower" />
          </aside>
          <div className="max-w-6xl flex-1">{children}</div>
          <aside className="hidden xl:block">
            <AdSlot size="tower" />
          </aside>
        </div>
        <footer className="fixed inset-x-0 bottom-0 z-10 flex justify-center border-t border-neutral-200 bg-white py-1">
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
