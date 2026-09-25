import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Young_Serif } from "next/font/google";
import "./globals.css";

// Young Serif: a warm, sturdy serif for headings (a nod to PhotoEZ's serif
// titles), with steady letters at every size. It comes in one weight, so
// globals.css turns off the browser's fake bold for it.
// Plus Jakarta Sans: friendly and clear for everything else.
const display = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: "400",
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PhotoEZ Cloud",
  description: "AI-assisted studio software for photographers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
