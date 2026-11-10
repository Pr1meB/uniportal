import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { THEME_SCRIPT } from "@/components/theme";
import { clash, geist, geistMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Uniportal — University Education Management", template: "%s · Uniportal" },
  description: "University Education Management Portal: registration, results and academic administration.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ece1" },
    { media: "(prefers-color-scheme: dark)", color: "#13110e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${clash.variable} ${geist.variable} ${geistMono.variable}`}>
      <head>
        {/* applies the saved theme before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
