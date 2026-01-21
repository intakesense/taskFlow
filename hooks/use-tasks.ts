// useTasks - React Query hooks that wrap task service functions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    CreateTaskInput,
    UpdateTaskInput
} from '@/lib/services/tasks';

// Query keys
export const taskKeys = {
    all: ['tasks'] as const,
    lists: () => [...taskKeys.all, 'list'] as const,
    details: () => [...taskKeys.all, 'detail'] as const,
    detail: (id: string) => [...taskKeys.details(), id] as const,
    stats: (userId: string) => [...taskKeys.all, 'stats', userId] as const,
};

// Re-export types
export type { CreateTaskInput, UpdateTaskInput };

// Hooks
export function useTasks() {
    return useQuery({
        queryKey: taskKeys.lists(),
        queryFn: () => getTasks(),
        // Use default staleTime from QueryProvider
    });
}

export function useTask(id: string | undefined) {
    return useQuery({
        queryKey: taskKeys.detail(id || ''),
        queryFn: () => getTaskById(id!),
        enabled: !!id,
    });
}

export function useCreateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, input }: { userId: string; input: CreateTaskInput }) =>
            createTask(userId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
            updateTask(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
