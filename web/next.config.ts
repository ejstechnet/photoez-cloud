import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the root to this folder so a stray lockfile higher up
    // (e.g. in the home directory) isn't mistaken for the project root.
    root: __dirname,
  },
};

export default nextConfig;
