import type { NextConfig } from "next";

// Security headers on every page: HTTPS only (HSTS), no MIME sniffing, no
// framing by other sites (nothing here is meant to be embedded), and only the
// origin sent as the referrer to other sites (gallery links carry their
// private token in the path).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
];

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the root to this folder so a stray lockfile higher up
    // (e.g. in the home directory) isn't mistaken for the project root.
    root: __dirname,
  },
  // Don't announce the framework to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
