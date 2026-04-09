import type { NextConfig } from "next";

// Environment variable validation - fail fast at build time
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'OPENAI_API_KEY',
  'OPENAI_REALTIME_MODEL',
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const nextConfig: NextConfig = {
  /* config options here */

  // Allow images from Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vtnpgsmsxnkbhgvuisds.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

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
