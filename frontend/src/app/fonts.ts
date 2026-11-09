import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

/** Clash Display (display / numerals), bundled locally — free for commercial use, see fonts/clash/Befonts-License.txt. */
export const clash = localFont({
  src: [
    { path: "./fonts/clash/ClashDisplay-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/clash/ClashDisplay-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/clash/ClashDisplay-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/clash/ClashDisplay-Semibold.otf", weight: "600", style: "normal" },
    { path: "./fonts/clash/ClashDisplay-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-clash",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

export const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
