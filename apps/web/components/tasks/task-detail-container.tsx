'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import {
  useTask,
  useTaskMessages,
  useTaskMessagesRealtime,
  useTaskNotes,
  useSendTaskMessage,
  useAddTaskNote,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskAssignees,
  useDialog,
} from '@/hooks'
import { TaskDetailView } from './task-detail-view'
import { DashboardLayout } from '@/components/layout'
import { Loader2 } from 'lucide-react'

interface TaskDetailContainerProps {
  taskId: string
}

export function TaskDetailContainer({ taskId }: TaskDetailContainerProps) {
  const router = useRouter()
  const { effectiveUser, profile } = useAuth()

  // Queries
  const { data: task, isLoading: loadingTask } = useTask(taskId)
  const { data: messages = [], isLoading: loadingMessages } = useTaskMessages(taskId)
  const { data: notes = [], isLoading: loadingNotes } = useTaskNotes(taskId)

  // Realtime
  useTaskMessagesRealtime(taskId)

  // Mutations
  const sendMessage = useSendTaskMessage()
  const addNote = useAddTaskNote()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const updateAssignees = useUpdateTaskAssignees()

  // Local state
  const [newMessage, setNewMessage] = useState('')
  const [newNote, setNewNote] = useState('')
  const [onHoldReason, setOnHoldReason] = useState('')

  // Dialogs
  const deleteDialog = useDialog()
  const onHoldDialog = useDialog()

  // Permissions
  const isAssigner = task?.assigned_by === effectiveUser?.id || false
  const isAssignee = task?.assignees?.some(a => a.id === effectiveUser?.id) || false
  const isParticipant = isAssigner || isAssignee || (profile?.is_admin ?? false)

  // Handlers
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !effectiveUser) return

    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content: newMessage.trim(),
    })

    setNewMessage('')
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !effectiveUser) return

    await addNote.mutateAsync({
      taskId,
      addedBy: effectiveUser.id,
      content: newNote.trim(),
      visibility: 'all',
    })

    setNewNote('')
  }

  const handleStatusChange = async (status: string) => {
    if (status === 'on_hold') {
      onHoldDialog.openDialog()
      return
    }

    await updateTask.mutateAsync({
      id: taskId,
      input: { status: status as 'pending' | 'in_progress' | 'on_hold' | 'archived' },
    })

    toast.success('Status updated')
  }

  const handleOnHoldConfirm = async () => {
    if (!onHoldReason.trim()) return

    await updateTask.mutateAsync({
      id: taskId,
      input: {
        status: 'on_hold',
        on_hold_reason: onHoldReason.trim(),
      },
    })

    toast.success('Task put on hold')
    setOnHoldReason('')
    onHoldDialog.closeDialog()
  }

  const handleDelete = async () => {
    await deleteTask.mutateAsync(taskId)
    toast.success('Task deleted')
    router.push('/tasks')
  }

  const handleArchive = async () => {
    await updateTask.mutateAsync({
      id: taskId,
      input: { status: 'archived' },
    })
    toast.success('Task archived')
  }

  const handleUpdateAssignees = async (userIds: string[]) => {
    await updateAssignees.mutateAsync({
      taskId,
      userIds,
    })
    toast.success('Assignees updated')
  }

  if (loadingTask) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Task not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <TaskDetailView
        task={task}
        messages={messages}
        notes={notes}
        isAssigner={isAssigner}
        isAssignee={isAssignee}
        isParticipant={isParticipant}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        newNote={newNote}
        setNewNote={setNewNote}
        onHoldReason={onHoldReason}
        setOnHoldReason={setOnHoldReason}
        deleteDialog={deleteDialog}
        onHoldDialog={onHoldDialog}
        loadingMessages={loadingMessages}
        loadingNotes={loadingNotes}
        sendingMessage={sendMessage.isPending}
        addingNote={addNote.isPending}
        updatingStatus={updateTask.isPending}
        deleting={deleteTask.isPending}
        onSendMessage={handleSendMessage}
        onAddNote={handleAddNote}
        onStatusChange={handleStatusChange}
        onOnHoldConfirm={handleOnHoldConfirm}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onUpdateAssignees={handleUpdateAssignees}
        updatingAssignees={updateAssignees.isPending}
      />
    </DashboardLayout>
  )
}
