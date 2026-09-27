import Link from "next/link";
import { isDarkColor, studioBarColor } from "@/lib/studio-bar";

export type NavItem = { href: string; label: string };

// The top menu on every public page of a studio (studio page, booking,
// client galleries): the studio's logo, full size and without a box, on a bar
// in the photographer's chosen color, then Home and the page's own links.
// Studios without a logo show their name instead.
export function StudioNav({
  slug,
  name,
  logoUrl,
  logoBg,
  links = [],
  sticky = false,
  children,
}: {
  slug: string | null;
  name: string;
  logoUrl: string | null;
  logoBg: string;
  links?: NavItem[];
  sticky?: boolean;
  // Buttons on the right, e.g. "Book now".
  children?: React.ReactNode;
}) {
  const color = studioBarColor(logoBg);
  const dark = isDarkColor(color);
  const home = slug ? `/studio/${slug}` : null;
  const linkClass = `hidden rounded-full px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap uppercase transition md:block ${
    dark ? "text-white/75 hover:bg-white/10 hover:text-white" : "text-brand-deep/70 hover:bg-brand-deep/5 hover:text-brand-deep"
  }`;

  const brand = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={name} className="h-14 w-auto max-w-[200px] object-contain sm:h-20 sm:max-w-[340px]" />
  ) : (
    <span className={`truncate font-display text-xl ${dark ? "text-white" : "text-brand-deep"}`}>{name}</span>
  );

  return (
    <nav
      className={`z-30 border-b shadow-sm ${sticky ? "sticky top-0" : ""} ${dark ? "border-white/10" : "border-border"}`}
      style={{ backgroundColor: color }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        {home ? (
          <Link href={home} className="flex min-w-0 items-center" aria-label={`${name} home`}>
            {brand}
          </Link>
        ) : (
          <span className="flex min-w-0 items-center">{brand}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {home && (
            <Link href={home} className={linkClass}>
              Home
            </Link>
          )}
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
          {children}
        </div>
      </div>
    </nav>
  );
}

// Whether a bar color needs light text (for buttons placed on the bar).
export function barIsDark(logoBg: string) {
  return isDarkColor(studioBarColor(logoBg));
}
