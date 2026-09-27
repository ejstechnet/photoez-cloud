import Link from "next/link";
import { PhotoEZCloudMark } from "@/components/brand";
import { StudioNav } from "./studio-nav";
import { studioLinks } from "@/lib/studio-links";

// Top bar for the studio's inner pages (booking, booking confirmation,
// contract, reschedule): the same menu as the studio page, each link jumping
// back to that section of it.
export async function StudioBar({
  slug,
  name,
  logoUrl,
  logoBg,
  bookButton = true,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoBg: string;
  // Off on the booking page itself.
  bookButton?: boolean;
}) {
  return (
    <StudioNav
      slug={slug}
      name={name}
      logoUrl={logoUrl}
      logoBg={logoBg}
      links={await studioLinks(slug)}
    >
      {bookButton && (
        <Link
          href={`/studio/${slug}/book`}
          className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-on-accent uppercase transition hover:-translate-y-0.5"
        >
          Book a session
        </Link>
      )}
    </StudioNav>
  );
}

export function StudioFooter() {
  return (
    <footer className="border-t border-border py-6">
      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <PhotoEZCloudMark className="h-5 w-7" /> Powered by PhotoEZ Cloud
      </p>
    </footer>
  );
}
