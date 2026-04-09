import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TaskFlow',
    short_name: 'TaskFlow',
    description: 'Hierarchical task assignment and management system',
    start_url: '/',
    display: 'standalone',
    background_color: '#171717',
    theme_color: '#171717',
    orientation: 'portrait-primary',
    scope: '/',
    icons: [
      // SVG fallback for modern browsers
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // PNG icons required for iOS web push (iOS 16.4+ silently fails without these)
      // ACTION REQUIRED: Generate these PNG files in /public from your SVG icon.
      // Use: https://www.simicart.com/manifest-generator.html or `sharp` npm package.
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-256x256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['productivity', 'business', 'utilities'],
    shortcuts: [
      {
        name: 'Tasks',
        short_name: 'Tasks',
        description: 'View and manage your tasks',
        url: '/tasks',
      },
      {
        name: 'Messages',
        short_name: 'Messages',
        description: 'View your conversations',
        url: '/',
      },
    ],
  }
}
