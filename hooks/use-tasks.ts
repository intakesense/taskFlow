// useTasks - React Query hooks with OPTIMISTIC UPDATES for instant UI feedback
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { getErrorMessage } from '@/lib/utils/error';
import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskAssignees,
    addTaskAssignee,
    removeTaskAssignee,
    CreateTaskInput,
    UpdateTaskInput
} from '@/lib/services/tasks';
import type { TaskWithUsers } from '@/lib/types';

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
interface UseTasksOptions {
    initialData?: TaskWithUsers[];
}

export function useTasks(options?: UseTasksOptions) {
    return useQuery({
        queryKey: taskKeys.lists(),
        queryFn: () => getTasks(),
        initialData: options?.initialData,
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
        onMutate: () => {
            // Haptic feedback when creating task
            haptics.medium();
        },
        onSuccess: () => {
            haptics.success();
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
        onError: (error) => {
            haptics.error();
            const message = getErrorMessage(error, 'Failed to create task');
            toast.error(message);
        },
    });
}

// OPTIMISTIC UPDATE: Instantly update UI, rollback on error
export function useUpdateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
            updateTask(id, input),

        // Optimistic update - runs BEFORE the actual mutation
        onMutate: async ({ id, input }) => {
            // Haptic feedback when updating task
            haptics.light();
            // Cancel any in-flight queries to prevent race conditions
            await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

            // Snapshot current state for potential rollback
            const previousTasks = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists());

            // Optimistically update the cache
            queryClient.setQueryData<TaskWithUsers[]>(taskKeys.lists(), (old) => {
                if (!old) return old;
                return old.map(task =>
                    task.id === id
                        ? { ...task, ...input, updated_at: new Date().toISOString() }
                        : task
                );
            });

            // Return context with previous state for rollback
            return { previousTasks };
        },

        // Rollback on error
        onError: (error, _variables, context) => {
            haptics.error();
            if (context?.previousTasks) {
                queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
            }
            const message = getErrorMessage(error, 'Failed to update task');
            toast.error(message);
        },

        onSuccess: () => {
            haptics.success();
        },

        // Sync with server on success
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

// OPTIMISTIC DELETE: Instantly remove from UI, rollback on error
export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteTask,

        // Optimistic delete
        onMutate: async (taskId) => {
            // Haptic feedback for delete action
            haptics.heavy();
            await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

            const previousTasks = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists());

            // Optimistically remove the task
            queryClient.setQueryData<TaskWithUsers[]>(taskKeys.lists(), (old) => {
                if (!old) return old;
                return old.filter(task => task.id !== taskId);
            });

            return { previousTasks };
        },

        onError: (error, _taskId, context) => {
            haptics.error();
            if (context?.previousTasks) {
                queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
            }
            const message = getErrorMessage(error, 'Failed to delete task');
            toast.error(message);
        },

        onSuccess: () => {
            haptics.success();
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}

// Multi-assignee management hooks

export function useUpdateTaskAssignees() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, userIds }: { taskId: string; userIds: string[] }) =>
            updateTaskAssignees(taskId, userIds),
        onMutate: () => {
            haptics.light();
        },
        onSuccess: () => {
            haptics.success();
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
        onError: (error) => {
            haptics.error();
            const message = getErrorMessage(error, 'Failed to update assignees');
            toast.error(message);
        },
    });
}

export function useAddTaskAssignee() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
            addTaskAssignee(taskId, userId),
        onMutate: () => {
            haptics.light();
        },
        onSuccess: () => {
            haptics.success();
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
        onError: (error) => {
            haptics.error();
            const message = getErrorMessage(error, 'Failed to add assignee');
            toast.error(message);
        },
    });
}

export function useRemoveTaskAssignee() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
            removeTaskAssignee(taskId, userId),
        onMutate: () => {
            haptics.light();
        },
        onSuccess: () => {
            haptics.success();
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
        onError: (error) => {
            haptics.error();
            const message = getErrorMessage(error, 'Failed to remove assignee');
            toast.error(message);
        },
    });
}
