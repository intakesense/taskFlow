import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Set proper cache headers
  async headers() {
    return [
      {
        // HTML pages - allow browser cache but always revalidate with server
        // This provides performance benefits while ensuring auth state is fresh
        source: '/:path((?!_next|api|.*\\.).*)',
        headers: [
          {
            key: 'Cache-Control',
            // Allow private browser cache, but must revalidate on every request
            value: 'private, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Next.js static files (_next/static/*) - long-term cache with immutable flag
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Public static assets - long-term cache
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // JavaScript and CSS bundles - shorter cache with revalidation
        source: '/(.*)\\.(js|css)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Service worker - no cache to ensure updates
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
