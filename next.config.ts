import type { NextConfig } from "next";

// Next.js configuration.
// We keep this minimal — complexity here is a smell that something architectural
// should be solved differently (e.g. proxy logic belongs in Route Handlers, not rewrites).
const nextConfig: NextConfig = {
  // images.remotePatterns will be needed in Phase 2+ when user avatars are served
  // from S3 or a CDN. Add entries here as each source is introduced rather than
  // opening a wildcard — that would allow any domain to serve images through Next.js.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
