import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS, referrerByCode } from "@/lib/referrals";
import { siteUrl } from "@/lib/site";

// A photographer's referral link: remembers who sent the visitor (for 60
// days, in case they sign up later), then shows the sign-up page.
export async function GET(_request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const clean = code.toLowerCase();
  const referrer = await referrerByCode(clean);
  // siteUrl, not request.url: behind the server's proxy the request
  // arrives addressed to the app's internal port.
  const response = NextResponse.redirect(`${siteUrl}${referrer ? `/signup?ref=${clean}` : "/signup"}`);
  if (referrer) {
    response.cookies.set(REFERRAL_COOKIE, clean, {
      maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: siteUrl.startsWith("https:"),
      path: "/",
    });
  }
  return response;
}
