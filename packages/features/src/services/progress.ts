import type {
  TaskMessageWithSender,
  ProgressUpdateWithComments,
  ProgressUpdatesByDate,
  ProgressUpdateWithTask,
} from '@taskflow/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logError } from '../utils/error';
import { getDateKey, formatProgressDate } from '../utils/date';

/**
 * Create progress service with injected Supabase client
 */
export function createProgressService(getSupabase: () => SupabaseClient) {
  return {
    /**
     * Fetch all progress updates for a task with their nested comments
     */
    async getProgressUpdates(taskId: string): Promise<ProgressUpdateWithComments[]> {
      const supabase = getSupabase();

      // Fetch all progress-type messages (both root updates and comments)
      const { data, error } = await supabase
        .from('task_messages')
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url)
        `
        )
        .eq('task_id', taskId)
        .eq('type', 'progress')
        .order('created_at', { ascending: true });

      if (error) {
        logError('getProgressUpdates', error);
        throw error;
      }

      const messages = data as TaskMessageWithSender[];

      // Separate root updates (no reply_to_id) from comments (has reply_to_id)
      const rootUpdates: TaskMessageWithSender[] = [];
      const commentsByParent = new Map<string, TaskMessageWithSender[]>();

      for (const msg of messages) {
        if (!msg.reply_to_id) {
          rootUpdates.push(msg);
        } else {
          if (!commentsByParent.has(msg.reply_to_id)) {
            commentsByParent.set(msg.reply_to_id, []);
          }
          commentsByParent.get(msg.reply_to_id)!.push(msg);
        }
      }

      // Combine root updates with their comments
      return rootUpdates.map((update) => ({
        ...update,
        comments: commentsByParent.get(update.id) || [],
        commentCount: (commentsByParent.get(update.id) || []).length,
      }));
    },

    /**
     * Get progress updates grouped by date for timeline display
     */
    async getProgressUpdatesByDate(taskId: string): Promise<ProgressUpdatesByDate[]> {
      const updates = await this.getProgressUpdates(taskId);

      // Group by date
      const grouped = new Map<string, ProgressUpdateWithComments[]>();

      for (const update of updates) {
        const dateKey = getDateKey(update.created_at);
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(update);
      }

      // Convert to array and sort by date (most recent first for the groups, but updates within group are chronological)
      const result: ProgressUpdatesByDate[] = [];
      const sortedDates = Array.from(grouped.keys()).sort().reverse();

      for (const date of sortedDates) {
        const dateUpdates = grouped.get(date)!;
        result.push({
          date,
          dateLabel: formatProgressDate(dateUpdates[0].created_at),
          updates: dateUpdates,
        });
      }

      return result;
    },

    /**
     * Create a new progress update
     */
    async createProgressUpdate(
      taskId: string,
      senderId: string,
      content: string
    ): Promise<TaskMessageWithSender> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_messages')
        .insert({
          task_id: taskId,
          sender_id: senderId,
          content,
          type: 'progress',
        })
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url)
        `
        )
        .single();

      if (error) {
        logError('createProgressUpdate', error);
        throw error;
      }

      return data as TaskMessageWithSender;
    },

    /**
     * Add a comment to an existing progress update
     */
    async addProgressComment(
      progressId: string,
      taskId: string,
      senderId: string,
      content: string
    ): Promise<TaskMessageWithSender> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_messages')
        .insert({
          task_id: taskId,
          sender_id: senderId,
          content,
          type: 'progress',
          reply_to_id: progressId,
        })
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url)
        `
        )
        .single();

      if (error) {
        logError('addProgressComment', error);
        throw error;
      }

      return data as TaskMessageWithSender;
    },

    /**
     * Fetch all progress updates across all tasks the user has access to.
     * Returns progress updates (excluding comments) with task info, sorted by most recent first.
     * Limit to recent updates (last 50) for performance.
     */
    async getAllProgressUpdates(limit: number = 50): Promise<ProgressUpdateWithTask[]> {
      const supabase = getSupabase();

      // Fetch root progress updates (no reply_to_id) with task info
      const { data, error } = await supabase
        .from('task_messages')
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url),
          task:tasks!task_messages_task_id_fkey(id, title, status)
        `
        )
        .eq('type', 'progress')
        .is('reply_to_id', null) // Only root updates, not comments
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logError('getAllProgressUpdates', error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...item,
        sender: item.sender,
        task: item.task as { id: string; title: string; status: string },
      })) as ProgressUpdateWithTask[];
    },
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
