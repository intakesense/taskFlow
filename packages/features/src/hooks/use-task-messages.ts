'use client';

// Task messages hooks with realtime subscriptions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type {
  TaskMessage,
  TaskMessageWithSender,
  TaskReactionWithUser,
  UserBasic,
  GroupedReaction,
} from '@taskflow/core';
import { CHANNELS, STALE_TIME } from '@taskflow/core';
import { useServices } from '../providers/services-context';
import { getErrorMessage } from '../utils/error';

// Query keys
export const taskMessageKeys = {
  all: ['task-messages'] as const,
  task: (taskId: string) => [...taskMessageKeys.all, taskId] as const,
};

// Common WhatsApp-style reactions
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

// Group reactions by emoji with user info
export function groupTaskReactions(
  reactions: TaskReactionWithUser[] | undefined,
  currentUserId: string
): GroupedReaction[] {
  if (!reactions || reactions.length === 0) return [];

  const groups = new Map<string, { count: number; users: UserBasic[]; hasCurrentUser: boolean }>();

  for (const r of reactions) {
    const existing = groups.get(r.emoji) || { count: 0, users: [], hasCurrentUser: false };
    existing.count++;
    if (r.user) existing.users.push(r.user);
    if (r.user_id === currentUserId) existing.hasCurrentUser = true;
    groups.set(r.emoji, existing);
  }

  return Array.from(groups.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    users: data.users,
    hasReacted: data.hasCurrentUser,
  }));
}

// Get the current user's reaction emoji on a message
export function getUserTaskReaction(
  reactions: TaskReactionWithUser[] | undefined,
  userId: string
): string | undefined {
  return reactions?.find((r) => r.user_id === userId)?.emoji;
}

// Hooks
export function useTaskMessages(taskId: string | undefined) {
  const { taskMessages } = useServices();

  return useQuery({
    queryKey: taskMessageKeys.task(taskId || ''),
    queryFn: () => taskMessages.fetchTaskMessages(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.MESSAGES,
  });
}

export function useSendTaskMessage() {
  const { taskMessages } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      taskId: string;
      senderId: string;
      content?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      replyToId?: string;
    }) => taskMessages.sendTaskMessage(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: taskMessageKeys.task(variables.taskId) });

      const previousMessages = queryClient.getQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId)
      );

      // Optimistic update
      const optimisticMessage: TaskMessageWithSender = {
        id: `temp-${Date.now()}`,
        task_id: variables.taskId,
        sender_id: variables.senderId,
        message: variables.content || '',
        content: variables.content || null,
        type: 'message',
        file_url: variables.fileUrl || null,
        file_name: variables.fileName || null,
        file_size: variables.fileSize || null,
        file_type: variables.fileType || null,
        reply_to_id: variables.replyToId || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        sender: null,
        reactions: [],
      };

      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(taskMessageKeys.task(variables.taskId), context.previousMessages);
      }
      toast.error(getErrorMessage(error, 'Failed to send message'));
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) => old.map((m) => (m.id.startsWith('temp-') ? data : m))
      );
    },
  });
}

export function useDeleteTaskMessage() {
  const { taskMessages } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; taskId: string }) =>
      taskMessages.deleteTaskMessage(messageId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: taskMessageKeys.task(variables.taskId),
      });

      const previousMessages = queryClient.getQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId)
      );

      // Optimistically mark as deleted
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) =>
          old.map((msg) =>
            msg.id === variables.messageId
              ? { ...msg, is_deleted: true, content: null, message: '' }
              : msg
          )
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          taskMessageKeys.task(variables.taskId),
          context.previousMessages
        );
      }
      toast.error(getErrorMessage(error, 'Failed to delete message'));
    },
  });
}

export function useSetTaskReaction() {
  const { taskMessages } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      messageId: string;
      taskId: string;
      userId: string;
      emoji: string;
      user: UserBasic;
      currentEmoji?: string;
    }) => taskMessages.setTaskReaction(input),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: taskMessageKeys.task(variables.taskId) });

      const previousMessages = queryClient.getQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId)
      );

      // Optimistically update reactions
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) =>
          old.map((msg) => {
            if (msg.id !== variables.messageId) return msg;

            let newReactions = [...(msg.reactions || [])];

            // Remove user's existing reaction
            newReactions = newReactions.filter((r) => r.user_id !== variables.userId);

            // Add new reaction (unless toggling off)
            if (variables.currentEmoji !== variables.emoji) {
              newReactions.push({
                id: `temp-${Date.now()}`,
                message_id: variables.messageId,
                user_id: variables.userId,
                emoji: variables.emoji,
                created_at: new Date().toISOString(),
                user: variables.user,
              } as TaskReactionWithUser);
            }

            return { ...msg, reactions: newReactions };
          })
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(taskMessageKeys.task(variables.taskId), context.previousMessages);
      }
      toast.error(getErrorMessage(error, 'Failed to react'));
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: taskMessageKeys.task(variables.taskId) });
    },
  });
}

// Realtime subscription for task messages
export function useTaskMessagesRealtime(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const { supabase } = useServices();

  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(CHANNELS.TASK_MESSAGES(taskId))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_messages',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload: { new: TaskMessage }) => {
          // Skip progress updates - handled by useTaskProgressRealtime
          if ((payload.new as TaskMessage & { type?: string }).type === 'progress') return;

          const { data: sender } = await supabase
            .from('users')
            .select('id, name, email, level, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const newMessage: TaskMessageWithSender = {
            ...(payload.new as TaskMessage),
            sender: sender as UserBasic | null,
            reactions: [],
          };

          queryClient.setQueryData<TaskMessageWithSender[]>(
            taskMessageKeys.task(taskId),
            (old = []) => {
              const exists = old.some(
                (m) =>
                  m.id === newMessage.id ||
                  (m.id.startsWith('temp-') && m.sender_id === newMessage.sender_id)
              );
              if (exists) {
                return old.map((m) =>
                  m.id.startsWith('temp-') && m.sender_id === newMessage.sender_id ? newMessage : m
                );
              }
              return [...old, newMessage];
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_messages',
          filter: `task_id=eq.${taskId}`,
        },
        (payload: { new: TaskMessage }) => {
          // Handle message edits/deletes
          queryClient.setQueryData<TaskMessageWithSender[]>(
            taskMessageKeys.task(taskId),
            (old = []) =>
              old.map((msg) =>
                msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
              )
          );
        }
      )
      .subscribe();

    // Subscribe to reactions changes
    const reactionsChannel = supabase
      .channel(`task-reactions:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_message_reactions',
        },
        () => {
          // Refetch messages to get updated reactions
          queryClient.invalidateQueries({
            queryKey: taskMessageKeys.task(taskId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [taskId, queryClient, supabase]);
}
