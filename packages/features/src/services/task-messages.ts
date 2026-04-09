import type {
  TaskMessage,
  TaskMessageWithSender,
  TaskReactionWithUser,
  UserBasic,
} from '@taskflow/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logError } from '../utils/error';

export interface SendTaskMessageInput {
  taskId: string;
  senderId: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyToId?: string;
}

export interface SetTaskReactionInput {
  messageId: string;
  taskId: string;
  userId: string;
  emoji: string;
  user: UserBasic;
  currentEmoji?: string;
}

export function createTaskMessagesService(getSupabase: () => SupabaseClient) {
  return {
    async fetchTaskMessages(taskId: string): Promise<TaskMessageWithSender[]> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_messages')
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url),
          reactions:task_message_reactions(
            id,
            emoji,
            user_id,
            created_at,
            user:users!task_message_reactions_user_id_fkey(id, name, email, level, avatar_url)
          )
        `
        )
        .eq('task_id', taskId)
        .neq('type', 'progress') // Exclude progress updates
        .order('created_at', { ascending: true });

      if (error) {
        logError('fetchTaskMessages', error);
        // Fallback without joins if the join fails
        const { data: messagesOnly, error: fallbackError } = await supabase
          .from('task_messages')
          .select('*')
          .eq('task_id', taskId)
          .neq('type', 'progress')
          .order('created_at', { ascending: true });

        if (fallbackError) {
          logError('fetchTaskMessages.fallback', fallbackError);
          throw fallbackError;
        }
        return (messagesOnly || []).map((m: TaskMessage) => ({
          ...m,
          sender: null,
          reactions: [],
        })) as TaskMessageWithSender[];
      }

      return data as TaskMessageWithSender[];
    },

    async sendTaskMessage(input: SendTaskMessageInput): Promise<TaskMessageWithSender> {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('task_messages')
        .insert({
          task_id: input.taskId,
          sender_id: input.senderId,
          message: input.content || '',
          content: input.content || null,
          file_url: input.fileUrl || null,
          file_name: input.fileName || null,
          file_size: input.fileSize || null,
          file_type: input.fileType || null,
          reply_to_id: input.replyToId || null,
        })
        .select(
          `
          *,
          sender:users!task_messages_sender_id_fkey(id, name, email, level, avatar_url)
        `
        )
        .single();

      if (error) {
        logError('sendTaskMessage', error);
        throw error;
      }
      return { ...data, reactions: [] } as TaskMessageWithSender;
    },

    async deleteTaskMessage(messageId: string): Promise<void> {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('task_messages')
        .update({ is_deleted: true, content: null, message: '' })
        .eq('id', messageId);

      if (error) {
        logError('deleteTaskMessage', error);
        throw error;
      }
    },

    async setTaskReaction(input: SetTaskReactionInput): Promise<TaskReactionWithUser | null> {
      const supabase = getSupabase();

      // If clicking same emoji, remove it (toggle off)
      if (input.currentEmoji === input.emoji) {
        const { error } = await supabase
          .from('task_message_reactions')
          .delete()
          .eq('message_id', input.messageId)
          .eq('user_id', input.userId);

        if (error) throw error;
        return null;
      }

      // Delete any existing reaction from this user on this message
      await supabase
        .from('task_message_reactions')
        .delete()
        .eq('message_id', input.messageId)
        .eq('user_id', input.userId);

      // Add the new reaction
      const { data, error } = await supabase
        .from('task_message_reactions')
        .insert({
          message_id: input.messageId,
          user_id: input.userId,
          emoji: input.emoji,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        user: input.user,
      } as TaskReactionWithUser;
    },
  };
}

export type TaskMessagesService = ReturnType<typeof createTaskMessagesService>;
