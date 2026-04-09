'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useServices } from '../providers/services-context';
import { getErrorMessage } from '../utils/error';
import type { ConversationWithMembers, MessageWithSender } from '@taskflow/core';
import type { CreateGroupInput, SendMessageInput } from '../services/messages';

// Query keys factory
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (userId?: string) => [...conversationKeys.lists(), userId] as const,
  messages: (conversationId: string) => [...conversationKeys.all, 'messages', conversationId] as const,
};

/**
 * Hook to fetch conversations for a user with real-time updates.
 */
export function useConversations(
  userId: string | undefined,
  options?: { initialData?: ConversationWithMembers[] }
) {
  const { messages: messagesService, supabase } = useServices();
  const queryClient = useQueryClient();

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    let invalidateTimeout: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (invalidateTimeout) clearTimeout(invalidateTimeout);
      invalidateTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
      }, 300);
    };

    const channel = supabase
      .channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, debouncedInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, debouncedInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, debouncedInvalidate)
      .subscribe();

    return () => {
      if (invalidateTimeout) clearTimeout(invalidateTimeout);
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, queryClient]);

  return useQuery({
    queryKey: conversationKeys.list(userId),
    queryFn: () => messagesService.getConversations(userId!),
    enabled: !!userId,
    initialData: options?.initialData,
  });
}

/**
 * Hook to fetch messages for a conversation with real-time updates.
 */
export function useMessages(
  conversationId: string | null,
  options?: {
    onNewMessage?: (message: MessageWithSender) => void;
  }
) {
  const { messages: messagesService, supabase } = useServices();
  const queryClient = useQueryClient();

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
          options?.onNewMessage?.(payload.new as MessageWithSender);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase, queryClient, options?.onNewMessage]);

  return useQuery({
    queryKey: conversationKeys.messages(conversationId || ''),
    queryFn: () => messagesService.getMessages(conversationId!),
    enabled: !!conversationId,
  });
}

/**
 * Hook to send a message.
 */
export function useSendMessage() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      senderId,
      ...input
    }: { conversationId: string; senderId: string } & SendMessageInput) =>
      messagesService.sendMessage(conversationId, senderId, input),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to send message');
      toast.error(message);
    },
  });
}

/**
 * Hook to create a DM conversation.
 */
export function useCreateDM() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, otherUserId }: { userId: string; otherUserId: string }) =>
      messagesService.createDM(userId, otherUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Conversation started');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to start conversation');
      toast.error(message);
    },
  });
}

/**
 * Hook to create a group conversation.
 */
export function useCreateGroup() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: CreateGroupInput }) =>
      messagesService.createGroup(userId, input),
    onSuccess: (_, { input }) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success(`Group "${input.name}" created`);
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to create group');
      toast.error(message);
    },
  });
}

/**
 * Hook to mark messages as read.
 */
export function useMarkAsRead() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      messagesService.markAsRead(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

// ============================================================================
// GROUP MANAGEMENT HOOKS
// ============================================================================

/**
 * Hook to update group name.
 */
export function useUpdateGroupName() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, name }: { conversationId: string; name: string }) =>
      messagesService.updateGroupName(conversationId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Group name updated');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to update group name');
      toast.error(message);
    },
  });
}

/**
 * Hook to add members to a group.
 */
export function useAddGroupMembers() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, memberIds }: { conversationId: string; memberIds: string[] }) =>
      messagesService.addGroupMembers(conversationId, memberIds),
    onSuccess: (_, { memberIds }) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success(`Added ${memberIds.length} member${memberIds.length > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to add members');
      toast.error(message);
    },
  });
}

/**
 * Hook to remove a member from a group.
 */
export function useRemoveGroupMember() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      messagesService.removeGroupMember(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Member removed');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to remove member');
      toast.error(message);
    },
  });
}

/**
 * Hook to leave a group (same as remove, but for current user).
 */
export function useLeaveGroup() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      messagesService.removeGroupMember(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Left group');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to leave group');
      toast.error(message);
    },
  });
}

/**
 * Hook to update group avatar.
 */
export function useUpdateGroupAvatar() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, avatarUrl }: { conversationId: string; avatarUrl: string | null }) =>
      messagesService.updateGroupAvatar(conversationId, avatarUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Group picture updated');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to update group picture');
      toast.error(message);
    },
  });
}

/**
 * Hook to upload and update group avatar.
 */
export function useUploadGroupAvatar() {
  const { messages: messagesService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, file }: { conversationId: string; file: File }) =>
      messagesService.uploadGroupAvatar(conversationId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success('Group picture updated');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to upload group picture');
      toast.error(message);
    },
  });
}
