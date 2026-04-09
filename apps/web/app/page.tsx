'use client'

import { TasksContainerSocial } from '@/components/tasks/tasks-container-social'

export default function HomePage() {
  // Auth handled by middleware - redirects to /login if not authenticated
  // React Query cache provides instant re-navigation (no skeleton flash)
  // Root route shows Tasks (main landing page)
  return <TasksContainerSocial />
}
