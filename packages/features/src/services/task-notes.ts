import type { TaskNote, TaskNoteWithAuthor } from '@taskflow/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logError } from '../utils/error';

export interface AddNoteInput {
  taskId: string;
  addedBy: string;
  content: string;
  visibleTo?: string[];
}

export function createTaskNotesService(getSupabase: () => SupabaseClient) {
  return {
    async fetchTaskNotes(taskId: string): Promise<TaskNoteWithAuthor[]> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_notes')
        .select(
          `
          *,
          author:users!task_notes_added_by_fkey(id, name, email, level)
        `
        )
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        logError('fetchTaskNotes', error);
        throw error;
      }
      return data as TaskNoteWithAuthor[];
    },

    async addTaskNote(input: AddNoteInput): Promise<TaskNote> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_notes')
        .insert({
          task_id: input.taskId,
          added_by: input.addedBy,
          content: input.content,
          visible_to: input.visibleTo ?? [],
        })
        .select()
        .single();

      if (error) {
        logError('addTaskNote', error);
        throw error;
      }
      return data as TaskNote;
    },

    async deleteTaskNote(noteId: string): Promise<void> {
      const supabase = getSupabase();

      const { error } = await supabase.from('task_notes').delete().eq('id', noteId);

      if (error) {
        logError('deleteTaskNote', error);
        throw error;
      }
    },
  };
}

export type TaskNotesService = ReturnType<typeof createTaskNotesService>;
