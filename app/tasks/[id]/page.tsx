'use client'

import { useParams } from 'next/navigation'
import { TaskDetailContainerSocial } from '@/components/tasks/task-detail-container-social'

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string

  return <TaskDetailContainerSocial taskId={taskId} />
}
