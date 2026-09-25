import Link from "next/link";
import { PhotoEZCloudMark } from "@/components/brand";

// Top bar for the studio's inner pages (booking, booking confirmation): the
// studio's logo and name, linking back to its studio page.
export function StudioBar({
  slug,
  name,
  logoUrl,
  logoBg,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoBg: string;
}) {
  return (
    <nav className="border-b border-white/10 bg-brand-deep text-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={`/studio/${slug}`} className="flex min-w-0 items-center gap-3">
          {logoUrl && (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg p-1" style={{ backgroundColor: logoBg }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            </span>
          )}
          <span className="truncate font-display text-lg">{name}</span>
        </Link>
        <Link
          href={`/studio/${slug}`}
          className="ml-auto rounded-full px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap text-white/75 uppercase transition hover:bg-white/10 hover:text-white"
        >
          Studio page
        </Link>
      </div>
    </nav>
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
