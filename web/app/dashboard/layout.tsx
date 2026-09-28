import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { Logo } from "@/components/brand";
import { trialDaysLeft } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { GearIcon } from "@/components/icons";
import { NavLink } from "./nav-link";
import { NavMenu } from "./nav-menu";
import { SignOutButton } from "./sign-out-button";

// Frame shared by every dashboard page: a PhotoEZ navy band with the logo,
// navigation pills, and sign-out.
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requirePhotographer();
  const [studio] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  // Days left in the free Pro trial (0 once it's over or a plan is chosen).
  const trialLeft = studio?.plan === "free" ? trialDaysLeft(studio.trialEndsAt) : 0;

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
                { href: "/dashboard/billing", label: "Billing" },
                { href: "/dashboard/billing#refer", label: "Refer a photographer" },
                { href: "/dashboard/emails", label: "Email log" },
              ]}
            />
          </nav>
          <SignOutButton />
        </div>
      </header>
      {trialLeft > 0 && (
        <p className="bg-lime px-4 py-2 text-center text-sm font-semibold text-brand-deep">
          Pro trial: {trialLeft === 1 ? "1 day" : `${trialLeft} days`} left.{" "}
          <Link href="/dashboard/billing" className="underline underline-offset-4">
            See plans
          </Link>
        </p>
      )}
      <main className="mx-auto w-full max-w-[1440px] px-4 py-10">{children}</main>
    </div>
  );
}
