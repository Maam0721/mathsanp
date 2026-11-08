import type { Metadata } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const notoSans = Noto_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSerif = Noto_Serif({
  weight: ["400", "500", "600"],
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MathSnap — Математикаа ойлгомжтой сур",
  description: "Математикийн бодлогоо сэдвээр ангилж, алхамчилсан тайлбараар ойлгоорой.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn">
      <body className={`${notoSans.variable} ${notoSerif.variable}`}>{children}</body>
    </html>
  );
}
