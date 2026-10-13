import Link from "next/link";
import { storeOpenFor } from "@/lib/store/launch";
import { requirePhotographer } from "@/lib/session";

// Every Store page, or a "coming soon" page while the store isn't open to
// everyone yet (lib/store/launch.ts).
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePhotographer();
  if (storeOpenFor(user.email)) return children;

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Online store</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Store: coming soon</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Soon your clients will be able to order prints and products of their photos right from their delivered gallery, and
        pay you through Stripe. Make and ship items yourself, or let SwaggPress Creations print and ship them for you.
      </p>
      <div className="card mt-8 max-w-3xl p-6">
        <h2 className="font-display text-xl font-bold">What&rsquo;s coming</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          <li>Prints, canvases, apparel and gifts, sold from each delivered gallery</li>
          <li>Your own prices, shipping and handling</li>
          <li>Printing and shipping handled by SwaggPress Creations, or items you make yourself</li>
          <li>Personalized products clients design with their own photos</li>
        </ul>
        <p className="mt-5 text-sm text-muted">
          It will show up right here when it opens. Until then, make sure Stripe is connected in{" "}
          <Link href="/dashboard/settings" className="link">
            Settings
          </Link>{" "}
          so you&rsquo;re ready on day one.
        </p>
      </div>
    </div>
  );
}
