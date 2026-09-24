import Link from "next/link";
import { requirePhotographer } from "@/lib/session";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

// Frame shared by every dashboard page: header, navigation, sign-out.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requirePhotographer();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold tracking-wide text-brand">
              PhotoEZ Cloud
            </Link>
            <nav className="flex gap-1">
              <NavLink href="/dashboard">Overview</NavLink>
              <NavLink href="/dashboard/clients">Clients</NavLink>
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
