'use client';

// Task Detail Container - Handles data fetching and state management
import { useState } from 'react';
import { toast } from 'sonner';
import type { Visibility } from '@taskflow/core';
import { Loader2 } from 'lucide-react';
import { useNavigation } from '../../providers/navigation-context';
import { useAuth } from '../../providers/auth-context';
import {
  useTask,
  useTaskMessages,
  useTaskMessagesRealtime,
  useTaskNotes,
  useTaskAuditLog,
  useSendTaskMessage,
  useAddTaskNote,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskAssignees,
  useDialog,
  useDriveAttachments,
  useInvalidateDriveAttachments,
} from '../../hooks';
import { TaskDetailView } from './task-detail-view';
import type { DriveFile } from '../messages/drive-picker';
import { useConfig } from '../../providers/config-context';


interface TaskDetailContainerProps {
  taskId: string;
}

export function TaskDetailContainer({ taskId }: TaskDetailContainerProps) {
  const { navigate } = useNavigation();
  const { user, profile } = useAuth();
  const { apiBaseUrl } = useConfig();

  // Queries
  const { data: task, isLoading: loadingTask } = useTask(taskId);
  const { data: messages = [], isLoading: loadingMessages } = useTaskMessages(taskId);
  const { data: notes = [], isLoading: loadingNotes } = useTaskNotes(taskId);
  const { data: auditLog = [] } = useTaskAuditLog(taskId);

  // Realtime
  useTaskMessagesRealtime(taskId);

  // Mutations
  const sendMessage = useSendTaskMessage();
  const addNote = useAddTaskNote();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateAssignees = useUpdateTaskAssignees();

  // Local state
  const [newMessage, setNewMessage] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<Visibility>('private');
  const [onHoldReason, setOnHoldReason] = useState('');
  const [requestChangesReason, setRequestChangesReason] = useState('');

  // Drive attachments via React Query (cached, loading state, refetchable)
  const { data: driveAttachments = [] } = useDriveAttachments(taskId);
  const invalidateDriveAttachments = useInvalidateDriveAttachments();

  // Dialogs
  const deleteDialog = useDialog();
  const onHoldDialog = useDialog();
  const requestChangesDialog = useDialog();

  // Permissions - use the user from auth context
  const effectiveUser = user;
  const isAssigner = task?.assigned_by === effectiveUser?.id || false;
  const isAssignee = task?.assignees?.some((a) => a.id === effectiveUser?.id) || false;
  const isParticipant = isAssigner || isAssignee || (profile?.is_admin ?? false);

  // Handlers
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !effectiveUser) return;

    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !effectiveUser) return;

    await addNote.mutateAsync({
      taskId,
      addedBy: effectiveUser.id,
      content: newNote.trim(),
      visibility: noteVisibility,
    });

    setNewNote('');
    setNoteVisibility('private');
  };

  const handleStatusChange = async (status: string) => {
    if (status === 'on_hold') {
      onHoldDialog.openDialog();
      return;
    }

    await updateTask.mutateAsync({
      id: taskId,
      input: { status: status as 'pending' | 'in_progress' | 'on_hold' | 'completed' | 'archived' },
    });

    if (status === 'completed') {
      toast.success('Marked as done — waiting for creator review');
    } else {
      toast.success('Status updated');
    }
  };

  const handleOnHoldConfirm = async () => {
    await updateTask.mutateAsync({
      id: taskId,
      input: {
        status: 'on_hold',
        on_hold_reason: onHoldReason || undefined,
      },
    });

    toast.success('Task put on hold');
    setOnHoldReason('');
    onHoldDialog.closeDialog();
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(taskId);
    toast.success('Task deleted');
    navigate('/tasks');
  };

  const handleArchive = async () => {
    await updateTask.mutateAsync({
      id: taskId,
      input: { status: 'archived' },
    });
    toast.success('Task completed');
  };

  const handleRequestChangesConfirm = async () => {
    if (!requestChangesReason.trim() || !effectiveUser) return;

    // Post feedback as a task message so the assignee sees it in the thread
    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content: `🔄 Changes requested: ${requestChangesReason.trim()}`,
    });

    // Revert to in_progress
    await updateTask.mutateAsync({
      id: taskId,
      input: { status: 'in_progress' },
    });

    toast.success('Changes requested — task reopened');
    setRequestChangesReason('');
    requestChangesDialog.closeDialog();
  };

  const handleAttachDriveFile = async (driveFile: DriveFile) => {
    if (!user) return
    const res = await fetch(`${apiBaseUrl}/api/google/drive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: driveFile.id,
        fileName: driveFile.name,
        mimeType: driveFile.mimeType,
        webViewLink: driveFile.url,
        iconLink: driveFile.iconUrl,
        taskId,
      }),
    })
    if (res.ok) {
      invalidateDriveAttachments(taskId)
      toast.success(`${driveFile.name} attached and shared`)
    } else {
      const body = await res.json().catch(() => ({}))
      if (body.code === 'NO_TOKEN') {
        toast.error('Connect Google account in Settings to attach Drive files')
      } else {
        toast.error('Failed to attach file')
      }
    }
  }

  const handleUpdateAssignees = async (userIds: string[]) => {
    await updateAssignees.mutateAsync({
      taskId,
      userIds,
    });
    toast.success('Assignees updated');
  };

  // Loading state
  const loading = loadingTask || loadingMessages || loadingNotes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  return (
    <TaskDetailView
        task={task}
        messages={messages}
        notes={notes}
        auditLog={auditLog}
        isAssigner={isAssigner}
        isAssignee={isAssignee}
        isParticipant={isParticipant}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        newNote={newNote}
        setNewNote={setNewNote}
        noteVisibility={noteVisibility}
        setNoteVisibility={setNoteVisibility}
        onHoldReason={onHoldReason}
        setOnHoldReason={setOnHoldReason}
        requestChangesReason={requestChangesReason}
        setRequestChangesReason={setRequestChangesReason}
        deleteDialog={deleteDialog}
        onHoldDialog={onHoldDialog}
        requestChangesDialog={requestChangesDialog}
        sendingMessage={sendMessage.isPending}
        addingNote={addNote.isPending}
        updatingStatus={updateTask.isPending}
        deleting={deleteTask.isPending}
        onSendMessage={handleSendMessage}
        onAddNote={handleAddNote}
        onStatusChange={handleStatusChange}
        onOnHoldConfirm={handleOnHoldConfirm}
        onRequestChangesConfirm={handleRequestChangesConfirm}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onUpdateAssignees={handleUpdateAssignees}
        updatingAssignees={updateAssignees.isPending}
        driveAttachments={driveAttachments}
        onAttachDriveFile={handleAttachDriveFile}
      />
  );
}
