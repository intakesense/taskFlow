'use client'

import { useAuth } from '@/lib/auth-context'
import {
  useTask,
  useTaskMessages,
  useTaskMessagesRealtime,
  useUpdateTask,
  useDeleteTask,
  useSendTaskMessage,
  useSetTaskReaction,
} from '@/hooks'
import { TaskDetailChatView } from './task-detail-chat-view'
import { DashboardLayout } from '@/components/layout'
import { Loader2 } from 'lucide-react'

interface TaskDetailContainerSocialProps {
  taskId: string
}

export function TaskDetailContainerSocial({ taskId }: TaskDetailContainerSocialProps) {
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
  const setReaction = useSetTaskReaction()

  // Handlers
  const handleSendMessage = async (params: {
    content?: string
    fileUrl?: string
    fileName?: string
    fileSize?: number
    fileType?: string
    replyToId?: string
  }) => {
    if (!effectiveUser) return

    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content: params.content,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      fileType: params.fileType,
      replyToId: params.replyToId,
    })
  }

  const handleReact = async (messageId: string, emoji: string, currentEmoji?: string) => {
    if (!effectiveUser) return

    await setReaction.mutateAsync({
      messageId,
      taskId,
      userId: effectiveUser.id,
      emoji,
      user: {
        id: effectiveUser.id,
        name: effectiveUser.name || '',
        email: effectiveUser.email || '',
        level: effectiveUser.level || 1,
        avatar_url: effectiveUser.avatar_url,
      },
      currentEmoji,
    })
  }

  const handleStatusChange = async (status: string, reason?: string) => {
    const input: { status: import('@/lib/types').TaskStatus; on_hold_reason?: string } = {
      status: status as import('@/lib/types').TaskStatus
    }
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
        currentUser={{
          id: effectiveUser.id,
          name: effectiveUser.name || '',
          email: effectiveUser.email || '',
          level: effectiveUser.level || 1,
          avatar_url: effectiveUser.avatar_url,
        }}
        onSendMessage={handleSendMessage}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onReact={handleReact}
        isLoadingMessages={loadingMessages}
        isSending={sendMessage.isPending}
      />
    </DashboardLayout>
  )
}
