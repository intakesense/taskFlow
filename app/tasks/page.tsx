'use client'

import { TasksContainerSocial } from '@/components/tasks/tasks-container-social'

export default function TasksPage() {
    // Auth handled by middleware - redirects to /login if not authenticated
    // React Query cache provides instant re-navigation (no skeleton flash)
    return <TasksContainerSocial />
}
