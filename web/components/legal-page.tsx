import Link from "next/link";
import { Logo } from "@/components/brand";

// Shared frame for the Terms of Service and Privacy Policy pages.

export const LEGAL = {
  company: "EJS Tech",
  service: "PhotoEZ Cloud",
  site: "photoezcloud.com",
  email: "support@photoezcloud.com",
  state: "Oregon",
  // Change when either document changes (shown at the top of both).
  updated: "October 2, 2026",
};

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Logo />
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
              Home
            </Link>
            <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
              Log in
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-12">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-white/70">Last updated {LEGAL.updated}</p>
        </div>
      </header>
      <main className="legal mx-auto w-full max-w-3xl px-4 py-12 leading-relaxed">{children}</main>
      <LegalFooter />
    </div>
  );
}

// Small footer with the legal links, for pages without the home page's footer.
export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-border py-6 text-center text-sm text-muted">
      © {new Date().getFullYear()} {LEGAL.company} ·{" "}
      <Link href="/terms" className="hover:text-foreground">
        Terms of Service
      </Link>{" "}
      ·{" "}
      <Link href="/privacy" className="hover:text-foreground">
        Privacy Policy
      </Link>
    </footer>
  );
}
