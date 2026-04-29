'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServices } from './services-context';
import { taskKeys } from '../hooks/use-tasks';

interface TasksRealtimeProviderProps {
  children: ReactNode;
}

/**
 * Mounts a single Supabase Realtime channel that watches the `tasks` and
 * `task_assignees` tables and invalidates the React Query cache on any change.
 *
 * Mount this once inside FeaturesProvider so that useTasks() and
 * useTasksInfinite() share one subscription instead of each creating their own.
 */
export function TasksRealtimeProvider({ children }: TasksRealtimeProviderProps) {
  const { supabase } = useServices();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        const taskId =
          (payload.new as { id?: string })?.id ??
          (payload.old as { id?: string })?.id;
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
        }
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'infinite'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, (payload) => {
        const taskId =
          (payload.new as { task_id?: string })?.task_id ??
          (payload.old as { task_id?: string })?.task_id;
        if (taskId) {
          queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
        }
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'infinite'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return <>{children}</>;
}
