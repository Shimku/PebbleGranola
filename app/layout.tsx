import type { ReactNode } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Serif_4, Space_Grotesk } from "next/font/google";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const sans = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Index × Granola",
  description:
    "Speak to Pebble Index 01. Get answers from your Granola notes.",
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: "#f7f7f2",
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
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
