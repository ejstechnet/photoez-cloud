import { z } from "zod";
import { pageParams } from "@/lib/migration/format";
import {
  addonPage,
  bookingPage,
  clientPage,
  contractPage,
  creditPage,
  galleryPage,
  inspoUrl,
  invoicePage,
  manifest,
  originalUrl,
  reviewPage,
  sessionTypePage,
  studioForRequest,
} from "@/lib/migration/source";
import { overLimit } from "@/lib/rate-limit";

// PhotoEZ Cloud's read-only migration API (docs/migration-format.md), for the
// PhotoEZ Migration plugin on WordPress. Every request needs the studio's
// migration key (Settings > Move to PhotoEZ for WordPress) as a Bearer token.
export async function GET(request: Request, { params }: RouteContext<"/api/migration/v1/[...path]">) {
  const studio = await studioForRequest(request);
  if (!studio) {
    // Only wrong keys count toward a limit, so a real transfer (thousands of
    // photos) is never slowed, but nobody can sit here guessing keys.
    if (await overLimit("migration-bad-key", 20, 60 * 60 * 1000)) return json({ error: "Too many tries. Try again in an hour." }, 429);
    return json({ error: "That migration key isn't valid. It may have expired or been revoked; make a new one in Settings." }, 401);
  }

  const path = (await params).path;
  const { offset, limit } = pageParams(new URL(request.url).searchParams);
  switch (path.join("/")) {
    case "manifest":
      return json(await manifest(studio));
    case "clients":
      return json(await clientPage(studio, offset, limit));
    case "addons":
      return json(await addonPage(studio, offset, limit));
    case "session-types":
      return json(await sessionTypePage(studio, offset, limit));
    case "contracts":
      return json(await contractPage(studio, offset, limit));
    case "galleries":
      // Galleries carry their photo lists, so fewer at a time.
      return json(await galleryPage(studio, offset, Math.min(limit, 20)));
    case "bookings":
      return json(await bookingPage(studio, offset, Math.min(limit, 50)));
    case "credits":
      return json(await creditPage(studio, offset, limit));
    case "reviews":
      return json(await reviewPage(studio, offset, limit));
    case "invoices":
      return json(await invoicePage(studio, offset, Math.min(limit, 50)));
  }
  // /photos/<id>/original: a short-lived link straight to the file. Booking
  // inspiration photos have ids starting "inspo-".
  if (path.length === 3 && path[0] === "photos" && path[2] === "original") {
    const inspo = path[1].startsWith("inspo-") ? path[1].slice(6) : null;
    const id = inspo ?? path[1];
    if (z.uuid().safeParse(id).success) {
      const url = inspo ? await inspoUrl(studio, id) : await originalUrl(studio, id);
      return url ? Response.redirect(url, 302) : json({ error: "Photo not found." }, 404);
    }
  }
  return json({ error: "Not found." }, 404);
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
