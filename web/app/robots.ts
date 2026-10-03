import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Search engines may read the public pages, but not the dashboard or the
// private client links (galleries, bookings, invoices, review forms, calendar
// feeds) or referral redirects.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/g/", "/booking/", "/review/", "/i/", "/calendar/", "/r/", "/reset-password", "/forgot-password"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
