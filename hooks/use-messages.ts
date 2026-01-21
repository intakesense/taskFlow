// useMessages - React Query hooks that wrap task messages service
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
    getTaskMessages,
    sendMessage,
    subscribeToMessages,
    unsubscribeFromMessages
} from '@/lib/services/messages';
import { TaskMessageWithSender, TaskMessage } from '@/lib/types';

// Query keys
export const messageKeys = {
    all: ['task-messages'] as const,
    task: (taskId: string) => [...messageKeys.all, taskId] as const,
};

// Hooks
export function useMessages(taskId: string | undefined) {
    return useQuery({
        queryKey: messageKeys.task(taskId || ''),
        queryFn: () => getTaskMessages(taskId!),
        enabled: !!taskId,
        staleTime: 10000, // 10 seconds
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, senderId, message }: { taskId: string; senderId: string; message: string }) =>
            sendMessage(taskId, senderId, message),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: messageKeys.task(variables.taskId) });
        },
    });
}

// Realtime subscription hook
export function useRealtimeMessages(taskId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!taskId) return;

        const channel = subscribeToMessages(taskId, (newMessage: TaskMessage) => {
            // Add new message to cache
            queryClient.setQueryData<TaskMessageWithSender[]>(
                messageKeys.task(taskId),
                (old = []) => [...old, { ...newMessage, sender: null }]
            );
        });

        return () => {
            unsubscribeFromMessages(channel);
        };
    }, [taskId, queryClient]);
}
