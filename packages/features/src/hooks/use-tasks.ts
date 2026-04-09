'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useServices } from '../providers/services-context';
import { haptics } from '../utils/haptics';
import { getErrorMessage } from '../utils/error';
import type { TaskWithUsers, TaskStatus } from '@taskflow/core';
import type { CreateTaskInput, UpdateTaskInput, TaskFilters, PaginatedTasksResult } from '../services/tasks';

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

// Query keys factory
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.lists(), filters] as const,
  infinite: (filters?: Omit<TaskFilters, 'cursor'>) => [...taskKeys.all, 'infinite', filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * Hook to fetch tasks with optional filters and real-time updates.
 */
export function useTasks(options?: {
  filters?: TaskFilters;
  initialData?: TaskWithUsers[];
}) {
  const { tasks, supabase } = useServices();
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return useQuery({
    queryKey: taskKeys.list(options?.filters),
    queryFn: () => tasks.getTasks(options?.filters),
    initialData: options?.initialData,
  });
}

/**
 * Hook to fetch tasks with infinite scroll / pagination support.
 * Use this for large datasets instead of useTasks.
 */
export function useTasksInfinite(options?: {
  filters?: Omit<TaskFilters, 'cursor'>;
  limit?: number;
}) {
  const { tasks, supabase } = useServices();
  const queryClient = useQueryClient();
  const limit = options?.limit || 25;

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-infinite-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.infinite(options?.filters) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.infinite(options?.filters) });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, options?.filters]);

  return useInfiniteQuery<PaginatedTasksResult>({
    queryKey: taskKeys.infinite(options?.filters),
    queryFn: ({ pageParam }) =>
      tasks.getTasksPaginated({
        ...options?.filters,
        cursor: pageParam as string | undefined,
        limit,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * Hook to fetch a single task by ID.
 */
export function useTask(taskId: string | null) {
  const { tasks } = useServices();

  return useQuery({
    queryKey: taskKeys.detail(taskId || ''),
    queryFn: () => tasks.getTaskById(taskId!),
    enabled: !!taskId,
  });
}

/**
 * Hook to create a new task.
 */
export function useCreateTask() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: CreateTaskInput }) =>
      tasks.createTask(userId, input),
    onMutate: () => {
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

/**
 * Hook to update an existing task with optimistic updates.
 */
export function useUpdateTask() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      tasks.updateTask(id, input),
    onMutate: async ({ id, input }) => {
      haptics.light();
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists());

      // Optimistically update
      queryClient.setQueryData<TaskWithUsers[]>(taskKeys.lists(), (old) => {
        if (!old) return old;
        return old.map(task =>
          task.id === id ? { ...task, ...input, updated_at: new Date().toISOString() } : task
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
      const message = getErrorMessage(error, 'Failed to update task');
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
 * Hook to delete a task with optimistic update.
 */
export function useDeleteTask() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasks.deleteTask(taskId),
    onMutate: async (taskId) => {
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
 * Hook to archive a task.
 */
export function useArchiveTask() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => tasks.archiveTask(taskId),
    onMutate: () => {
      haptics.medium();
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (error) => {
      haptics.error();
      const message = getErrorMessage(error, 'Failed to archive task');
      toast.error(message);
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
  const { tasks } = useServices();
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
    }) => tasks.changeStatus(taskId, status, { onHoldReason }),
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

/**
 * Hook to update task assignees.
 */
export function useUpdateTaskAssignees() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userIds }: { taskId: string; userIds: string[] }) =>
      tasks.updateTaskAssignees(taskId, userIds),
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

/**
 * Hook to add a single assignee to a task.
 */
export function useAddTaskAssignee() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      tasks.addTaskAssignee(taskId, userId),
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

/**
 * Hook to remove a single assignee from a task.
 */
export function useRemoveTaskAssignee() {
  const { tasks } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      tasks.removeTaskAssignee(taskId, userId),
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

/**
 * Hook to fetch task audit log (who changed what, when).
 */
export function useTaskAuditLog(taskId: string | null, limit = 50) {
  const { tasks } = useServices();

  return useQuery({
    queryKey: [...taskKeys.detail(taskId || ''), 'audit'] as const,
    queryFn: () => tasks.getTaskAuditLog(taskId!, limit),
    enabled: !!taskId,
  });
}
