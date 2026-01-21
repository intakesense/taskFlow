'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import {
  useTask,
  useTaskMessages,
  useTaskMessagesRealtime,
  useUpdateTask,
  useDeleteTask,
  useSendTaskMessage,
} from '@/hooks'
import { TaskDetailChatView } from './task-detail-chat-view'
import { DashboardLayout } from '@/components/layout'
import { Loader2 } from 'lucide-react'

interface TaskDetailContainerSocialProps {
  taskId: string
}

export function TaskDetailContainerSocial({ taskId }: TaskDetailContainerSocialProps) {
  const router = useRouter()
  const { effectiveUser } = useAuth()

  // Queries
  const { data: task, isLoading: loadingTask } = useTask(taskId)
  const { data: messages = [], isLoading: loadingMessages } = useTaskMessages(taskId)

  // Realtime
  useTaskMessagesRealtime(taskId)

  // Mutations
  const sendMessage = useSendTaskMessage()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  // Handlers
  const handleSendMessage = async (content: string) => {
    if (!effectiveUser) return

    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      message: content,
    })
  }

  const handleStatusChange = async (status: string, reason?: string) => {
    const input: any = { status }
    if (reason) {
      input.on_hold_reason = reason
    }

    await updateTask.mutateAsync({
      id: taskId,
      input,
    })
  }

  const handleDelete = async () => {
    await deleteTask.mutateAsync(taskId)
  }

  // Loading state
  const loading = loadingTask

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!task || !effectiveUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Task not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <TaskDetailChatView
        task={task}
        messages={messages}
        currentUserId={effectiveUser.id}
        onSendMessage={handleSendMessage}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        isLoadingMessages={loadingMessages}
      />
    </DashboardLayout>
  )
}
