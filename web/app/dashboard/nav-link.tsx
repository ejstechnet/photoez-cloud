"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Dashboard navigation pill, lime when its section is open.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
        active ? "bg-lime text-brand-deep" : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
