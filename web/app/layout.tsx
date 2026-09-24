import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Fraunces: a bold, characterful serif for headings (a nod to PhotoEZ's
// serif titles). Plus Jakarta Sans: friendly and clear for everything else.
const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
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
