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
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
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
