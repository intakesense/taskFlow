// useTasks - React Query hooks with OPTIMISTIC UPDATES for instant UI feedback
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import { getErrorMessage } from '@/lib/utils/error';
import { createClient } from '@/lib/supabase/client';
import {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    changeStatus,
    updateTaskAssignees,
    addTaskAssignee,
    removeTaskAssignee,
    CreateTaskInput,
    UpdateTaskInput,
    GetTasksFilters,
} from '@/lib/services/tasks';
import type { TaskWithUsers, TaskStatus } from '@/lib/types';

// User-friendly error messages for status transition failures
const statusErrorMessages: Record<string, string> = {
    'Only assignees can start': 'You must be assigned to this task to start it',
    'Only assignees can put': 'You must be assigned to this task to pause it',
    'on_hold_reason is required': 'Please provide a reason for pausing this task',
    'Only task creator can complete': 'Only the task creator can mark this complete',
    'Only task creator can reopen': 'Only the task creator can reopen this task',
    'Only assignees can resume': 'You must be assigned to this task to resume it',
    'Invalid status transition': 'This status change is not allowed',
};

function getStatusChangeErrorMessage(error: unknown): string {
    const errorStr = error instanceof Error ? error.message : String(error);

    for (const [key, message] of Object.entries(statusErrorMessages)) {
        if (errorStr.includes(key)) {
            return message;
        }
    }

    return 'Failed to change task status';
}

const supabase = createClient();

// Query keys
export const taskKeys = {
    all: ['tasks'] as const,
    lists: () => [...taskKeys.all, 'list'] as const,
    details: () => [...taskKeys.all, 'detail'] as const,
    detail: (id: string) => [...taskKeys.details(), id] as const,
    stats: (userId: string) => [...taskKeys.all, 'stats', userId] as const,
};

// Re-export types
export type { CreateTaskInput, UpdateTaskInput, GetTasksFilters };

// Hooks
export function useTasks(filters?: Omit<GetTasksFilters, 'cursor'>) {
    const queryClient = useQueryClient();

    // Subscribe to real-time task updates
    useEffect(() => {
        const channel = supabase
            .channel('tasks-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                () => {
                    queryClient.invalidateQueries({ queryKey: taskKeys.all });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_assignees' },
                () => {
                    queryClient.invalidateQueries({ queryKey: taskKeys.all });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const query = useInfiniteQuery({
        queryKey: [...taskKeys.lists(), filters],
        queryFn: ({ pageParam }) =>
            getTasks({ ...filters, cursor: pageParam as string | undefined }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

    // Flatten pages into a single tasks array for consumers
    const tasks = query.data?.pages.flatMap(p => p.tasks) ?? [];

    return { ...query, tasks };
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

/**
 * Hook to change task status with workflow validation.
 * The database enforces status transition rules:
 * - pending -> in_progress: Only assignees
 * - in_progress -> on_hold: Only assignees, requires reason
 * - in_progress -> archived: Only creator
 * - on_hold -> in_progress: Only assignees
 * - archived -> in_progress: Only creator (reopen)
 */
export function useChangeTaskStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            taskId,
            status,
            onHoldReason,
        }: {
            taskId: string;
            status: TaskStatus;
            onHoldReason?: string;
        }) => changeStatus(taskId, status, { onHoldReason }),
        onMutate: async ({ taskId, status }) => {
            haptics.light();
            // Cancel in-flight queries
            await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

            // Snapshot previous value
            const previousTasks = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists());

            // Optimistically update
            queryClient.setQueryData<TaskWithUsers[]>(taskKeys.lists(), (old) => {
                if (!old) return old;
                return old.map((task) =>
                    task.id === taskId
                        ? { ...task, status, updated_at: new Date().toISOString() }
                        : task
                );
            });

            return { previousTasks };
        },
        onError: (error, _, context) => {
            haptics.error();
            // Rollback on error
            if (context?.previousTasks) {
                queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
            }
            // Use user-friendly error message
            const message = getStatusChangeErrorMessage(error);
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
