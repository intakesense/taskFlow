'use client';

// Task notes hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { STALE_TIME } from '@taskflow/core';
import { useServices } from '../providers/services-context';
import { getErrorMessage } from '../utils/error';

// Query keys
export const taskNoteKeys = {
  all: ['task-notes'] as const,
  task: (taskId: string) => [...taskNoteKeys.all, taskId] as const,
};

// Hooks
export function useTaskNotes(taskId: string | undefined) {
  const { taskNotes } = useServices();

  return useQuery({
    queryKey: taskNoteKeys.task(taskId || ''),
    queryFn: () => taskNotes.fetchTaskNotes(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.TASKS,
  });
}

export function useAddTaskNote() {
  const { taskNotes } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { taskId: string; addedBy: string; content: string; visibleTo?: string[] }) =>
      taskNotes.addTaskNote(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskNoteKeys.task(variables.taskId) });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to add note'));
    },
  });
}

export function useDeleteTaskNote() {
  const { taskNotes } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => taskNotes.deleteTaskNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskNoteKeys.all });
      toast.success('Note deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete note'));
    },
  });
}
