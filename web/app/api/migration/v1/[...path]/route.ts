import { z } from "zod";
import { pageParams } from "@/lib/migration/format";
import {
  addonPage,
  clientPage,
  contractPage,
  galleryPage,
  manifest,
  originalUrl,
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
  }
  // /photos/<id>/original: a short-lived link straight to the file.
  if (path.length === 3 && path[0] === "photos" && path[2] === "original" && z.uuid().safeParse(path[1]).success) {
    const url = await originalUrl(studio, path[1]);
    return url ? Response.redirect(url, 302) : json({ error: "Photo not found." }, 404);
  }
  return json({ error: "Not found." }, 404);
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
