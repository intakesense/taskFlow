// Task messages hooks with realtime subscriptions
// Full-featured: reactions, replies, file attachments (matching conversation messages)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaskMessage, TaskMessageWithSender, TaskReactionWithUser, UserBasic, GroupedReaction } from '@/lib/types';
import { CHANNELS, STALE_TIME } from '@/lib/constants';
import { toast } from 'sonner';
import { logError, getErrorMessage } from '@/lib/utils/error';

const supabase = createClient();

// Query keys
export const taskMessageKeys = {
  all: ['task-messages'] as const,
  task: (taskId: string) => [...taskMessageKeys.all, taskId] as const,
};

// Common WhatsApp-style reactions
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

// Fetch task messages with sender info and reactions
async function fetchTaskMessages(taskId: string): Promise<TaskMessageWithSender[]> {
  const { data, error } = await supabase
    .from('task_messages')
    .select(`
      *,
      sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url),
      reactions:task_message_reactions(
        id,
        emoji,
        user_id,
        created_at,
        user:users!task_message_reactions_user_id_fkey(id, name, email, level, avatar_url)
      )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('fetchTaskMessages', error);
    // Fallback without joins if the join fails (table might not exist yet)
    const { data: messagesOnly, error: fallbackError } = await supabase
      .from('task_messages')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (fallbackError) {
      logError('fetchTaskMessages.fallback', fallbackError);
      throw fallbackError;
    }
    return (messagesOnly || []).map((m: TaskMessage) => ({
      ...m,
      sender: null,
      reactions: [],
    })) as TaskMessageWithSender[];
  }

  return data as TaskMessageWithSender[];
}

// Send message input type
interface SendTaskMessageInput {
  taskId: string;
  senderId: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyToId?: string;
}

// Send message
async function sendTaskMessage(input: SendTaskMessageInput): Promise<TaskMessageWithSender> {
  const { data, error } = await supabase
    .from('task_messages')
    .insert({
      task_id: input.taskId,
      sender_id: input.senderId,
      message: input.content || '', // Legacy field (required by DB)
      content: input.content || null,
      file_url: input.fileUrl || null,
      file_name: input.fileName || null,
      file_size: input.fileSize || null,
      file_type: input.fileType || null,
      reply_to_id: input.replyToId || null,
    })
    .select(`
      *,
      sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url)
    `)
    .single();

  if (error) {
    logError('sendTaskMessage', error);
    throw error;
  }
  return { ...data, reactions: [] } as TaskMessageWithSender;
}

// Delete message (soft delete)
async function deleteTaskMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('task_messages')
    .update({ is_deleted: true, content: null, message: '' })
    .eq('id', messageId);

  if (error) {
    logError('deleteTaskMessage', error);
    throw error;
  }
}

// Set reaction - WhatsApp style (one reaction per user, replaces previous)
interface SetTaskReactionInput {
  messageId: string;
  taskId: string;
  userId: string;
  emoji: string;
  user: UserBasic;
  currentEmoji?: string; // User's current reaction (if any) to remove
}

async function setTaskReaction(input: SetTaskReactionInput): Promise<TaskReactionWithUser | null> {
  // If clicking same emoji, remove it (toggle off)
  if (input.currentEmoji === input.emoji) {
    const { error } = await supabase
      .from('task_message_reactions')
      .delete()
      .eq('message_id', input.messageId)
      .eq('user_id', input.userId);

    if (error) throw error;
    return null;
  }

  // Delete any existing reaction from this user on this message
  await supabase
    .from('task_message_reactions')
    .delete()
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId);

  // Add the new reaction
  const { data, error } = await supabase
    .from('task_message_reactions')
    .insert({
      message_id: input.messageId,
      user_id: input.userId,
      emoji: input.emoji,
    })
    .select(`
      *,
      user:users!task_message_reactions_user_id_fkey(id, name, email, level, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data as TaskReactionWithUser;
}

// ============= HOOKS =============

export function useTaskMessages(taskId: string | undefined) {
  return useQuery({
    queryKey: taskMessageKeys.task(taskId || ''),
    queryFn: () => fetchTaskMessages(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.MESSAGES,
  });
}

export function useSendTaskMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendTaskMessage,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskMessageKeys.task(variables.taskId),
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId)
      );

      // Optimistically add message
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
        sender: null, // Will be filled on success
        reactions: [],
      };

      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          taskMessageKeys.task(variables.taskId),
          context.previousMessages
        );
      }
      toast.error(getErrorMessage(error, 'Failed to send message'));
    },
    onSuccess: (data, variables) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) => old.map((msg) =>
          msg.id.startsWith('temp-') ? data : msg
        )
      );
    },
  });
}

export function useDeleteTaskMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; taskId: string }) =>
      deleteTaskMessage(messageId),
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
        (old = []) => old.map((msg) =>
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setTaskReaction,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: taskMessageKeys.task(variables.taskId),
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId)
      );

      // Optimistically update
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) =>
          old.map((msg) => {
            if (msg.id !== variables.messageId) return msg;

            const currentReactions = msg.reactions || [];

            // Remove user's existing reaction
            const withoutUserReaction = currentReactions.filter(
              (r) => r.user_id !== variables.userId
            );

            // If toggling off (same emoji), just return without user's reaction
            if (variables.currentEmoji === variables.emoji) {
              return { ...msg, reactions: withoutUserReaction };
            }

            // Add new reaction
            const newReaction: TaskReactionWithUser = {
              id: `temp-${Date.now()}`,
              message_id: variables.messageId,
              user_id: variables.userId,
              emoji: variables.emoji,
              created_at: new Date().toISOString(),
              user: variables.user,
            };

            return {
              ...msg,
              reactions: [...withoutUserReaction, newReaction],
            };
          })
      );

      return { previousMessages };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          taskMessageKeys.task(variables.taskId),
          context.previousMessages
        );
      }
    },
    onSuccess: (result, variables) => {
      // Replace optimistic update with real data
      queryClient.setQueryData<TaskMessageWithSender[]>(
        taskMessageKeys.task(variables.taskId),
        (old = []) =>
          old.map((msg) => {
            if (msg.id !== variables.messageId) return msg;

            if (!result) {
              // Reaction was removed
              return {
                ...msg,
                reactions: (msg.reactions || []).filter(
                  (r) => r.user_id !== variables.userId
                ),
              };
            }

            // Replace temp reaction with real one
            return {
              ...msg,
              reactions: (msg.reactions || []).map((r) =>
                r.id.startsWith('temp-') && r.user_id === variables.userId
                  ? result
                  : r
              ),
            };
          })
      );
    },
  });
}

// Realtime subscription for task messages
export function useTaskMessagesRealtime(taskId: string | undefined) {
  const queryClient = useQueryClient();

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
          // Fetch sender info for the new message
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

          // Add to cache if not already present (avoids duplicates from optimistic updates)
          queryClient.setQueryData<TaskMessageWithSender[]>(
            taskMessageKeys.task(taskId),
            (old = []) => {
              const exists = old.some(
                (m) => m.id === newMessage.id || (m.id.startsWith('temp-') && m.sender_id === newMessage.sender_id)
              );
              if (exists) {
                // Replace temp message with real one
                return old.map((m) =>
                  m.id.startsWith('temp-') && m.sender_id === newMessage.sender_id
                    ? newMessage
                    : m
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
          queryClient.setQueryData<TaskMessageWithSender[]>(
            taskMessageKeys.task(taskId),
            (old = []) =>
              old.map((msg) =>
                msg.id === payload.new.id
                  ? { ...msg, ...payload.new }
                  : msg
              )
          );
        }
      )
      .subscribe();

    // Also subscribe to reactions
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
  }, [taskId, queryClient]);
}

// ============= HELPER FUNCTIONS =============

// Helper to group reactions by emoji for display
export function groupTaskReactions(
  reactions: TaskReactionWithUser[] | undefined,
  currentUserId: string
): GroupedReaction[] {
  if (!reactions || reactions.length === 0) return [];

  const grouped = new Map<string, { users: UserBasic[]; hasReacted: boolean }>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji) || { users: [], hasReacted: false };
    if (reaction.user) {
      existing.users.push(reaction.user);
    }
    if (reaction.user_id === currentUserId) {
      existing.hasReacted = true;
    }
    grouped.set(reaction.emoji, existing);
  }

  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.users.length,
    users: data.users,
    hasReacted: data.hasReacted,
  }));
}

// Get user's current reaction on a message
export function getUserTaskReaction(
  reactions: TaskReactionWithUser[] | undefined,
  userId: string
): string | undefined {
  if (!reactions) return undefined;
  const userReaction = reactions.find((r) => r.user_id === userId);
  return userReaction?.emoji;
}
