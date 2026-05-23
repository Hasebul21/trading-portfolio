import type { NextConfig } from "next";

// Default Next.js already serves `/_next/static/*` and other build assets with
// long-lived `Cache-Control: public, max-age=31536000, immutable`. The previous
// catch-all `/:path*` no-store header overrode those, forcing the browser to
// re-download every JS/CSS chunk on every navigation. Scope no-store to the
// API surface (where freshness matters) and let pages/static assets keep their
// defaults so navigations are instant after first load.
const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
