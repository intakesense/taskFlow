// Task notes hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TaskNote, TaskNoteWithAuthor } from '@/lib/types';
import { STALE_TIME } from '@/lib/constants';
import { toast } from 'sonner';

const supabase = createClient();

// Query keys
export const taskNoteKeys = {
  all: ['task-notes'] as const,
  task: (taskId: string) => [...taskNoteKeys.all, taskId] as const,
};

// Fetch task notes
async function fetchTaskNotes(taskId: string): Promise<TaskNoteWithAuthor[]> {
  const { data, error } = await supabase
    .from('task_notes')
    .select(`
      *,
      author:users!task_notes_added_by_fkey(id, name, email, level)
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as TaskNoteWithAuthor[];
}

// Add note
interface AddNoteInput {
  taskId: string;
  addedBy: string;
  content: string;
  visibility: string;
}

async function addTaskNote(input: AddNoteInput): Promise<TaskNote> {
  const { data, error} = await supabase
    .from('task_notes')
    .insert({
      task_id: input.taskId,
      added_by: input.addedBy,
      content: input.content,
      visibility: input.visibility,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TaskNote;
}

// Delete note
async function deleteTaskNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('task_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

// Hooks
export function useTaskNotes(taskId: string | undefined) {
  return useQuery({
    queryKey: taskNoteKeys.task(taskId || ''),
    queryFn: () => fetchTaskNotes(taskId!),
    enabled: !!taskId,
    staleTime: STALE_TIME.TASKS,
  });
}

export function useAddTaskNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addTaskNote,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskNoteKeys.task(variables.taskId) });
      toast.success('Note added');
    },
    onError: () => {
      toast.error('Failed to add note');
    },
  });
}

export function useDeleteTaskNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskNoteKeys.all });
      toast.success('Note deleted');
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });
}
