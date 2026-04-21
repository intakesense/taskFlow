import type { MetadataRoute } from 'next'

// Bump this version string whenever icons change — it cache-busts the icon
// URLs in the manifest so installed PWAs pick up the new logo without
// requiring an uninstall/reinstall.
const ICON_VERSION = 'v2'

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
      {
        src: `/icons/icon-192x192.png?${ICON_VERSION}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `/icons/icon-256x256.png?${ICON_VERSION}`,
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/icons/icon-384x384.png?${ICON_VERSION}`,
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/icons/icon-512x512.png?${ICON_VERSION}`,
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
