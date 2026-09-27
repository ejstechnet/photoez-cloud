import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Search engines may read the public pages, but not the dashboard or the
// private client links (galleries, bookings, review forms).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api", "/g/", "/booking/", "/review/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
