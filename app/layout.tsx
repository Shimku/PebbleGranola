import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Space_Grotesk } from "next/font/google";
import "./globals.css";

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const sans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Index × Granola",
  description:
    "Pair Pebble Index 01 with Granola. Afterthoughts, prep, and open loops.",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Index × Granola",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
