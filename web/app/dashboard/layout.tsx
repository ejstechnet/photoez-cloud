import { Logo } from "@/components/brand";
import { requirePhotographer } from "@/lib/session";
import { GearIcon } from "@/components/icons";
import { NavLink } from "./nav-link";
import { NavMenu } from "./nav-menu";
import { SignOutButton } from "./sign-out-button";

// Frame shared by every dashboard page: a PhotoEZ navy band with the logo,
// navigation pills, and sign-out.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requirePhotographer();

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
          <Logo />
          {/* Scrolls sideways on phones; wraps onto a second row on wider screens so no link hides. */}
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:min-w-0 sm:flex-1 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/dashboard">Overview</NavLink>
            <NavMenu
              label="Clients"
              items={[
                { href: "/dashboard/inquiries", label: "Inquiries" },
                { href: "/dashboard/clients", label: "Clients" },
                { href: "/dashboard/reviews", label: "Reviews" },
              ]}
            />
            <NavMenu
              label="Bookings"
              items={[
                { href: "/dashboard/bookings", label: "Bookings", exact: true },
                { href: "/dashboard/bookings/setup", label: "Booking setup" },
                { href: "/dashboard/gift-cards", label: "Gift cards" },
              ]}
            />
            <NavLink href="/dashboard/galleries">Galleries</NavLink>
            <NavLink href="/dashboard/assistant">Assistant</NavLink>
            <NavMenu
              label={
                <>
                  <GearIcon size={15} strokeWidth={2.25} /> Settings
                </>
              }
              items={[
                { href: "/dashboard/settings", label: "Settings" },
                { href: "/dashboard/design", label: "Design" },
                { href: "/dashboard/emails", label: "Email log" },
              ]}
            />
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-10">{children}</main>
    </div>
  );
}
