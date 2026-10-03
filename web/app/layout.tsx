import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Young_Serif } from "next/font/google";
import "./globals.css";
import { CookieNotice } from "@/components/cookie-notice";
import { siteUrl } from "@/lib/site";

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

// Site-wide defaults for search engines and link previews. Pages set their
// own title and description; metadataBase turns relative links (canonical
// addresses, share images) into full photoezcloud.com addresses.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PhotoEZ Cloud",
  description:
    "All-in-one studio software for photographers: booking, contracts, client galleries, invoices, payments, a print store, and AI help.",
  applicationName: "PhotoEZ Cloud",
  openGraph: { siteName: "PhotoEZ Cloud", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
