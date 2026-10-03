import Link from "next/link";
import { Logo } from "@/components/brand";

// The navy header for the articles pages, like the pricing page's.
export function ArticlesHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Home
          </Link>
          <Link href="/pricing" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Pricing
          </Link>
          <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Log in
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-4xl px-4 pt-6 pb-14">{children}</div>
    </header>
  );
}
