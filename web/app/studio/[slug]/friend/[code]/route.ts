import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { FRIEND_COOKIE, FRIEND_COOKIE_DAYS, referringClient } from "@/lib/client-referrals";
import { siteUrl } from "@/lib/site";

// A client's share-with-a-friend link: remembers who shared it (for 60 days,
// in case the friend books later), then opens the studio's booking page,
// where the friend discount shows.
export async function GET(_request: NextRequest, { params }: RouteContext<"/studio/[slug]/friend/[code]">) {
  const { slug: rawSlug, code: rawCode } = await params;
  const slug = rawSlug.toLowerCase();
  const code = rawCode.toLowerCase();
  const [studio] = await db.select({ id: photographers.id }).from(photographers).where(eq(photographers.studioSlug, slug));
  const referrer = studio ? await referringClient(studio.id, code) : null;
  // siteUrl, not request.url: behind the server's proxy the request arrives
  // addressed to the app's internal port.
  const response = NextResponse.redirect(`${siteUrl}/studio/${slug}${referrer ? "/book" : ""}`);
  if (referrer) {
    response.cookies.set(FRIEND_COOKIE, code, {
      maxAge: FRIEND_COOKIE_DAYS * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: siteUrl.startsWith("https:"),
      path: "/",
    });
  }
  return response;
}
