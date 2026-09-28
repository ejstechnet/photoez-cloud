import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS, referrerByCode } from "@/lib/referrals";

// A photographer's referral link: remembers who sent the visitor (for 60
// days, in case they sign up later), then shows the sign-up page.
export async function GET(request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const clean = code.toLowerCase();
  const referrer = await referrerByCode(clean);
  const response = NextResponse.redirect(new URL(referrer ? `/signup?ref=${clean}` : "/signup", request.url));
  if (referrer) {
    response.cookies.set(REFERRAL_COOKIE, clean, {
      maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
    });
  }
  return response;
}
