'use client';

// useReactions - Message reaction operations with React Query
// WhatsApp-style: Single reaction per user per message (new replaces old)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MessageWithSender, ReactionWithUser, UserBasic, GroupedReaction } from '@taskflow/core';
import { useSupabase } from '../providers/services-context';
import { conversationKeys } from './use-conversations';

// Common WhatsApp-style reactions
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

// Set reaction - WhatsApp style (one reaction per user, replaces previous)
export interface SetReactionInput {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
  user: UserBasic;
  currentEmoji?: string; // User's current reaction (if any) to remove
}

export function useSetReaction() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();

  return useMutation({
    mutationFn: async (input: SetReactionInput): Promise<ReactionWithUser | null> => {
      // If clicking same emoji, remove it (toggle off)
      if (input.currentEmoji === input.emoji) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', input.messageId)
          .eq('user_id', input.userId);

        if (error) throw error;
        return null;
      }

      // Delete any existing reaction from this user on this message
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', input.messageId)
        .eq('user_id', input.userId);

      // Add the new reaction
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: input.messageId,
          user_id: input.userId,
          emoji: input.emoji,
        })
        .select(
          `
          *,
          user:users!message_reactions_user_id_fkey(id, name, email, level)
        `
        )
        .single();

      if (error) throw error;
      return data as ReactionWithUser;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: conversationKeys.messages(variables.conversationId),
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithSender[]>(
        conversationKeys.messages(variables.conversationId)
      );

      // Optimistically update
      queryClient.setQueryData<MessageWithSender[]>(
        conversationKeys.messages(variables.conversationId),
        (old = []) =>
          old.map((msg) => {
            if (msg.id !== variables.messageId) return msg;

            const currentReactions = msg.reactions || [];

            // Remove user's existing reaction
            const withoutUserReaction = currentReactions.filter(
              (r) => r.user_id !== variables.userId
            );

            // If toggling off (same emoji), just return without user's reaction
            if (variables.currentEmoji === variables.emoji) {
              return { ...msg, reactions: withoutUserReaction };
            }

            // Add new reaction
            const newReaction: ReactionWithUser = {
              id: `temp-${Date.now()}`,
              message_id: variables.messageId,
              user_id: variables.userId,
              emoji: variables.emoji,
              created_at: new Date().toISOString(),
              user: variables.user,
            };

            return {
              ...msg,
              reactions: [...withoutUserReaction, newReaction],
            };
          })
      );

      return { previousMessages };
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          conversationKeys.messages(variables.conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: (result, variables) => {
      // Replace optimistic update with real data
      queryClient.setQueryData<MessageWithSender[]>(
        conversationKeys.messages(variables.conversationId),
        (old = []) =>
          old.map((msg) => {
            if (msg.id !== variables.messageId) return msg;

            if (!result) {
              // Reaction was removed
              return {
                ...msg,
                reactions: (msg.reactions || []).filter((r) => r.user_id !== variables.userId),
              };
            }

            // Replace temp reaction with real one
            return {
              ...msg,
              reactions: (msg.reactions || []).map((r) =>
                r.id.startsWith('temp-') && r.user_id === variables.userId ? result : r
              ),
            };
          })
      );
    },
  });
}

// Helper to group reactions by emoji for display
export function groupReactions(
  reactions: ReactionWithUser[] | undefined,
  currentUserId: string
): GroupedReaction[] {
  if (!reactions || reactions.length === 0) return [];

  const grouped = new Map<string, { users: UserBasic[]; hasReacted: boolean }>();

  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji) || { users: [], hasReacted: false };
    if (reaction.user) {
      existing.users.push(reaction.user);
    }
    if (reaction.user_id === currentUserId) {
      existing.hasReacted = true;
    }
    grouped.set(reaction.emoji, existing);
  }

  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.users.length,
    users: data.users,
    hasReacted: data.hasReacted,
  }));
}

// Get user's current reaction on a message
export function getUserReaction(
  reactions: ReactionWithUser[] | undefined,
  userId: string
): string | undefined {
  if (!reactions) return undefined;
  const userReaction = reactions.find((r) => r.user_id === userId);
  return userReaction?.emoji;
}
