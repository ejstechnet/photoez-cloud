import { Logo } from "@/components/brand";
import { requirePhotographer } from "@/lib/session";
import { GearIcon } from "@/components/icons";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

// Frame shared by every dashboard page: a PhotoEZ navy band with the logo,
// navigation pills, and sign-out.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requirePhotographer();

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
          <Logo />
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
            <NavLink href="/dashboard">Overview</NavLink>
            <NavLink href="/dashboard/inquiries">Inquiries</NavLink>
            <NavLink href="/dashboard/bookings">Bookings</NavLink>
            <NavLink href="/dashboard/galleries">Galleries</NavLink>
            <NavLink href="/dashboard/clients">Clients</NavLink>
            <NavLink href="/dashboard/settings">
              <GearIcon size={15} strokeWidth={2.25} /> Settings
            </NavLink>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
