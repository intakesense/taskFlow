// Task messages hooks with realtime subscriptions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaskMessage, TaskMessageWithSender } from '@/lib/types';
import { CHANNELS, STALE_TIME } from '@/lib/constants';
import { toast } from 'sonner';

const supabase = createClient();

// Query keys
export const taskMessageKeys = {
  all: ['task-messages'] as const,
  task: (taskId: string) => [...taskMessageKeys.all, taskId] as const,
};

// Fetch task messages
async function fetchTaskMessages(taskId: string): Promise<TaskMessageWithSender[]> {
  const { data, error } = await supabase
    .from('task_messages')
    .select(`
      *,
      sender:users!task_messages_sender_id_fkey(*)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as TaskMessageWithSender[];
}

// Send message
async function sendTaskMessage(taskId: string, senderId: string, message: string): Promise<TaskMessage> {
  const { data, error } = await supabase
    .from('task_messages')
    .insert({
      task_id: taskId,
      sender_id: senderId,
      message
    })
    .select()
    .single();

  if (error) throw error;
  return data as TaskMessage;
}

// Hooks
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
    mutationFn: ({ taskId, senderId, message }: { taskId: string; senderId: string; message: string }) =>
      sendTaskMessage(taskId, senderId, message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskMessageKeys.task(variables.taskId) });
    },
    onError: () => {
      toast.error('Failed to send message');
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
          filter: `task_id=eq.${taskId}`
        },
        async (payload) => {
          // Fetch sender info for the new message
          const { data: sender } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.new.sender_id)
            .single();

          const newMessage: TaskMessageWithSender = {
            ...(payload.new as TaskMessage),
            sender: sender,
          };

          // Optimistically add to cache
          queryClient.setQueryData<TaskMessageWithSender[]>(
            taskMessageKeys.task(taskId),
            (old = []) => [...old, newMessage]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);
}
