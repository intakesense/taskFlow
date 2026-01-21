import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Set proper cache headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // No caching for HTML pages - always revalidate
            // This prevents stale auth state on hard refresh
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      {
        // Allow caching for static assets
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|gif|webp|js|css|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
