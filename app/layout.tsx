import type { Metadata } from "next";
import { Fredoka, Lexend } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Elearning Sample",
  description:
    "An interactive elearning sample built with Next.js using an AI assisted workflow. It teaches the alphabet from A to E with an animated lesson, spoken letters, drag and drop matching, and a score screen.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${lexend.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white font-sans">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
