"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Dashboard navigation link, highlighted when its section is open.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand/10 text-brand" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
