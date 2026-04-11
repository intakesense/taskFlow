'use client';

// Task Detail Container Social - Handles data fetching for social/chat-centric task view
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskStatus } from '@taskflow/core';

import { useAuth } from '../../providers/auth-context';
import { useServices } from '../../providers/services-context';
import {
  useTask,
  useTaskMessages,
  useTaskMessagesRealtime,
  useUpdateTask,
  useDeleteTask,
  useSendTaskMessage,
  useSetTaskReaction,
  useUpdateTaskAssignees,
  useTaskNotes,
  useAddTaskNote,
  useTaskProgressByDate,
  useCreateProgressUpdate,
  useAddProgressComment,
  useTaskProgressRealtime,
} from '../../hooks';
import { TaskDetailChatView } from './task-detail-chat-view';

interface TaskDetailContainerSocialProps {
  taskId: string;
}

export function TaskDetailContainerSocial({ taskId }: TaskDetailContainerSocialProps) {
  const { effectiveUser } = useAuth();
  const { fileUpload } = useServices();

  // Queries
  const { data: task, isLoading: loadingTask } = useTask(taskId);
  const { data: messages = [], isLoading: loadingMessages } = useTaskMessages(taskId);
  const { data: notes = [], isLoading: loadingNotes } = useTaskNotes(taskId);
  const { data: progressByDate = [], isLoading: loadingProgress } = useTaskProgressByDate(taskId);

  // Realtime
  useTaskMessagesRealtime(taskId);
  useTaskProgressRealtime(taskId);

  // Mutations
  const sendMessage = useSendTaskMessage();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const setReaction = useSetTaskReaction();
  const updateAssignees = useUpdateTaskAssignees();
  const addNote = useAddTaskNote();
  const createProgress = useCreateProgressUpdate();
  const addProgressComment = useAddProgressComment();

  // Handlers
  const handleSendMessage = async (params: {
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    replyToId?: string;
  }) => {
    if (!effectiveUser) return;

    await sendMessage.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content: params.content,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      fileSize: params.fileSize,
      fileType: params.fileType,
      replyToId: params.replyToId,
    });
  };

  const handleSendFile = async (file: File, replyToId?: string) => {
    if (!effectiveUser || !fileUpload) return;

    try {
      toast.loading('Uploading file...', { id: 'file-upload' });

      // Upload file to storage
      const uploadedFile = await fileUpload.uploadFile(file, effectiveUser.id);

      // Send message with file attachment
      await sendMessage.mutateAsync({
        taskId,
        senderId: effectiveUser.id,
        fileUrl: uploadedFile.url,
        fileName: file.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        replyToId,
      });

      toast.success('File uploaded', { id: 'file-upload' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload file';
      toast.error(message, { id: 'file-upload' });
    }
  };

  const handleSendVoiceMessage = async (audioBlob: Blob, replyToId?: string) => {
    if (!effectiveUser || !fileUpload) return;

    try {
      toast.loading('Sending voice message...', { id: 'voice-upload' });

      // Convert blob to file
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: audioBlob.type });

      // Upload voice file
      const uploadedFile = await fileUpload.uploadFile(file, effectiveUser.id);

      // Send message with voice attachment
      await sendMessage.mutateAsync({
        taskId,
        senderId: effectiveUser.id,
        fileUrl: uploadedFile.url,
        fileName: file.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        replyToId,
      });

      toast.success('Voice message sent', { id: 'voice-upload' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send voice message';
      toast.error(message, { id: 'voice-upload' });
    }
  };

  const handleReact = async (messageId: string, emoji: string, currentEmoji?: string) => {
    if (!effectiveUser) return;

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
    });
  };

  const handleStatusChange = async (status: string, reason?: string) => {
    const input: { status: TaskStatus; on_hold_reason?: string } = {
      status: status as TaskStatus,
    };
    if (reason) {
      input.on_hold_reason = reason;
    }

    await updateTask.mutateAsync({
      id: taskId,
      input,
    });
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(taskId);
  };

  const handleUpdateAssignees = async (userIds: string[]) => {
    await updateAssignees.mutateAsync({ taskId, userIds });
    toast.success('Assignees updated');
  };

  const handleAddNote = async (content: string, visibility: string) => {
    if (!effectiveUser) return;

    await addNote.mutateAsync({
      taskId,
      addedBy: effectiveUser.id,
      content,
      visibility,
    });
  };

  const handleCreateProgress = async (content: string) => {
    if (!effectiveUser) return;

    await createProgress.mutateAsync({
      taskId,
      senderId: effectiveUser.id,
      content,
      sender: {
        id: effectiveUser.id,
        name: effectiveUser.name || '',
        email: effectiveUser.email || '',
        level: effectiveUser.level || 1,
        avatar_url: effectiveUser.avatar_url,
      },
    });
    toast.success('Progress update posted');
  };

  const handleAddProgressComment = async (progressId: string, content: string) => {
    if (!effectiveUser) return;

    await addProgressComment.mutateAsync({
      progressId,
      taskId,
      senderId: effectiveUser.id,
      content,
      sender: {
        id: effectiveUser.id,
        name: effectiveUser.name || '',
        email: effectiveUser.email || '',
        level: effectiveUser.level || 1,
        avatar_url: effectiveUser.avatar_url,
      },
    });
  };

  // Loading state
  const loading = loadingTask;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task || !effectiveUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  return (
    <TaskDetailChatView
        task={task}
        messages={messages}
        notes={notes}
        progressByDate={progressByDate}
        currentUserId={effectiveUser.id}
        currentUser={{
          id: effectiveUser.id,
          name: effectiveUser.name || '',
          email: effectiveUser.email || '',
          level: effectiveUser.level || 1,
          avatar_url: effectiveUser.avatar_url,
        }}
        onSendMessage={handleSendMessage}
        onSendFile={fileUpload ? handleSendFile : undefined}
        onSendVoiceMessage={fileUpload ? handleSendVoiceMessage : undefined}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onReact={handleReact}
        onAddNote={handleAddNote}
        onUpdateAssignees={handleUpdateAssignees}
        onCreateProgress={handleCreateProgress}
        onAddProgressComment={handleAddProgressComment}
        updatingAssignees={updateAssignees.isPending}
        isLoadingMessages={loadingMessages}
        isLoadingNotes={loadingNotes}
        isLoadingProgress={loadingProgress}
        isSending={sendMessage.isPending}
        isAddingNote={addNote.isPending}
        isCreatingProgress={createProgress.isPending}
        isAddingProgressComment={addProgressComment.isPending}
      />
  );
}
