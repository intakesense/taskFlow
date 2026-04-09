'use client';

// useChatMessages - Message operations with React Query
// Migrated from apps/web/hooks/use-chat-messages.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import type {
  Message,
  MessageWithSender,
  UserBasic,
  ConversationWithMembers,
} from '@taskflow/core';

import { useSupabase } from '../providers/services-context';
import { conversationKeys } from './use-conversations';
import { logError, getErrorMessage } from '../utils/error';
import { createRealtimeManager } from '../utils/realtime-manager';

// Query keys
export const chatMessageKeys = {
  all: ['messages'] as const,
  conversation: (conversationId: string) => [...chatMessageKeys.all, conversationId] as const,
  search: (query: string) => [...chatMessageKeys.all, 'search', query] as const,
};

/**
 * Hook to fetch messages for a conversation
 */
export function useChatMessages(conversationId: string | undefined) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: chatMessageKeys.conversation(conversationId || ''),
    queryFn: async (): Promise<MessageWithSender[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select(
          `
          *,
          sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url),
          reactions:message_reactions(
            id,
            emoji,
            user_id,
            created_at,
            user:users!message_reactions_user_id_fkey(id, name, email, level, avatar_url)
          )
        `
        )
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) {
        logError('fetchMessages', error);
        // Fallback without joins
        const { data: messagesOnly, error: fallbackError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId!)
          .order('created_at', { ascending: true });

        if (fallbackError) {
          logError('fetchMessages.fallback', fallbackError);
          throw fallbackError;
        }
        return (messagesOnly || []).map((m: Message) => ({
          ...m,
          sender: null,
          reactions: [],
        })) as MessageWithSender[];
      }

      return data as MessageWithSender[];
    },
    enabled: !!conversationId,
  });
}

/**
 * Fetch messages function for prefetching
 */
export function createFetchMessages(supabase: ReturnType<typeof useSupabase>) {
  return async (conversationId: string): Promise<MessageWithSender[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select(
        `
        *,
        sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url),
        reactions:message_reactions(
          id,
          emoji,
          user_id,
          created_at,
          user:users!message_reactions_user_id_fkey(id, name, email, level, avatar_url)
        )
      `
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as MessageWithSender[];
  };
}

/**
 * Hook to send a chat message with optimistic updates
 */
export function useSendChatMessage() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      senderId: string;
      content?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      replyToId?: string;
    }): Promise<MessageWithSender> => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: input.senderId,
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
          sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url)
        `
        )
        .single();

      if (error) {
        logError('sendMessage', error);
        throw new Error(`Failed to send message: ${error.message}`);
      }

      return data as MessageWithSender;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: chatMessageKeys.conversation(variables.conversationId),
      });

      const previousMessages = queryClient.getQueryData<MessageWithSender[]>(
        chatMessageKeys.conversation(variables.conversationId)
      );

      const stableKey = `${variables.conversationId}-${Date.now()}-${Math.random()}`;

      const optimisticMessage: MessageWithSender & { _stableKey?: string } = {
        id: `temp-${Date.now()}`,
        conversation_id: variables.conversationId,
        sender_id: variables.senderId,
        content: variables.content || null,
        file_url: variables.fileUrl || null,
        file_name: variables.fileName || null,
        file_size: variables.fileSize || null,
        file_type: variables.fileType || null,
        reply_to_id: variables.replyToId || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        search_vector: null,
        sender: null,
        reactions: [],
        _stableKey: stableKey,
      };

      queryClient.setQueryData<MessageWithSender[]>(
        chatMessageKeys.conversation(variables.conversationId),
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages, stableKey };
    },
    onError: (err, variables, context) => {
      toast.error(getErrorMessage(err, 'Failed to send message'));

      if (context?.previousMessages) {
        queryClient.setQueryData(
          chatMessageKeys.conversation(variables.conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: (newMessage, variables, context) => {
      queryClient.setQueryData<MessageWithSender[]>(
        chatMessageKeys.conversation(variables.conversationId),
        (old = []) => {
          const tempIndex = old.findIndex((msg) => msg.id.startsWith('temp-'));

          if (tempIndex !== -1) {
            const newMessages = [...old];
            newMessages[tempIndex] = {
              ...newMessage,
              _stableKey: context?.stableKey,
            } as MessageWithSender;
            return newMessages;
          }

          const exists = old.some((msg) => msg.id === newMessage.id);
          return exists
            ? old
            : [...old, { ...newMessage, _stableKey: context?.stableKey } as MessageWithSender];
        }
      );

      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/**
 * Consolidated realtime hook for messages + typing + online status
 */
export function useConversationRealtime(
  conversationId: string | undefined,
  currentUserId: string | undefined,
  onNewMessage?: (message: Message) => void
) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<UserBasic[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Create realtime manager scoped to this supabase client
  const realtimeManager = useMemo(() => createRealtimeManager(supabase), [supabase]);

  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  });

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setTypingUsers([]);
      setOnlineUserIds(new Set());
      return;
    }

    let retryCount = 0;
    const MAX_RETRIES = 3;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCleanedup = false;
    let hadChannelError = false;

    const handleNewMessage = async (payload: { new: Message }) => {
      const newMessage = payload.new;

      if (newMessage.conversation_id !== conversationId) return;
      if (newMessage.sender_id === currentUserId) return;

      // Try to resolve sender from cache
      let sender: UserBasic | null = null;
      const allCachedConvs = queryClient.getQueriesData<ConversationWithMembers[]>({
        queryKey: conversationKeys.all,
      });
      for (const [, conversationsData] of allCachedConvs) {
        if (!conversationsData) continue;
        const conversation = conversationsData.find((c) => c.id === conversationId);
        if (conversation?.members) {
          sender = conversation.members.find((m) => m.id === newMessage.sender_id) || null;
          if (sender) break;
        }
      }

      // Fallback: fetch sender
      if (!sender) {
        const { data: senderData } = await supabase
          .from('users')
          .select('id, name, email, level, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();
        sender = senderData as UserBasic;
      }

      const messageWithSender: MessageWithSender = { ...newMessage, sender, reactions: [] };

      queryClient.setQueryData<MessageWithSender[]>(
        chatMessageKeys.conversation(conversationId),
        (old = []) =>
          old.some((msg) => msg.id === messageWithSender.id) ? old : [...old, messageWithSender]
      );
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      onNewMessageRef.current?.(newMessage);
    };

    interface PresenceState {
      user_id?: string;
      online_at?: string;
      typing?: boolean;
      user?: UserBasic;
    }

    const parsePresenceState = (
      rawState: Record<string, unknown[]>
    ): { typing: UserBasic[]; online: Set<string> } => {
      const typing: UserBasic[] = [];
      const online = new Set<string>();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      Object.values(rawState).forEach((presences) => {
        (presences as PresenceState[]).forEach((p) => {
          if (!p.user_id || p.user_id === currentUserId) return;
          if (p.online_at && new Date(p.online_at).getTime() > fiveMinutesAgo) {
            online.add(p.user_id);
          }
          if (p.typing && p.user) typing.push(p.user);
        });
      });

      return { typing, online };
    };

    const syncPresence = (channel: ReturnType<typeof realtimeManager.getOrCreateChannel>) => {
      const { typing, online } = parsePresenceState(
        channel.presenceState() as Record<string, unknown[]>
      );
      setTypingUsers(typing);
      setOnlineUserIds(online);
    };

    const setupChannel = () => {
      if (isCleanedup) return;

      // Always force remove first to ensure clean state
      realtimeManager.forceRemoveChannel(conversationId);
      const ch = realtimeManager.getOrCreateChannel(conversationId);

      ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
        .on('presence', { event: 'sync' }, () => syncPresence(ch))
        .subscribe((status) => {
          if (isCleanedup) return;

          if (status === 'SUBSCRIBED') {
            retryCount = 0;
            hadChannelError = false;
            ch.track({ user_id: currentUserId, online_at: new Date().toISOString() }).catch(
              (err) => logError('presenceTrack', err)
            );
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            hadChannelError = true;

            if (retryCount < MAX_RETRIES) {
              const delay = Math.pow(2, retryCount + 1) * 1000;
              retryCount++;
              retryTimeout = setTimeout(setupChannel, delay);
            } else {
              logError('realtimeSubscription', { status, conversationId });
              toast.error('Connection lost. Messages may not update in real-time.');
            }
          }
        });

      realtimeManager.markAsConfigured(conversationId);
    };

    // Always setup fresh channel - forceRemoveChannel handles cleanup
    setupChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || isCleanedup) return;

      queryClient.invalidateQueries({ queryKey: chatMessageKeys.conversation(conversationId) });

      if (hadChannelError) {
        if (retryTimeout) clearTimeout(retryTimeout);
        retryCount = 0;
        setupChannel();
      } else {
        const ch = realtimeManager.getOrCreateChannel(conversationId);
        ch.track({ user_id: currentUserId, online_at: new Date().toISOString() }).catch((err) =>
          logError('presenceTrack.visibility', err)
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCleanedup = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setTypingUsers([]);
      setOnlineUserIds(new Set());

      const ch = realtimeManager.getOrCreateChannel(conversationId);
      ch.untrack().catch((err) => logError('presenceUntrack', err));
      realtimeManager.releaseChannel(conversationId);
    };
  }, [conversationId, currentUserId, queryClient, supabase, realtimeManager]);

  const isUserOnline = useCallback(
    (userId: string): boolean => onlineUserIds.has(userId),
    [onlineUserIds]
  );

  return {
    typingUsers,
    onlineUserIds,
    isUserOnline,
    onlineCount: onlineUserIds.size,
  };
}

/**
 * Typing indicator using Supabase Presence
 */
export function useSetTyping() {
  const supabase = useSupabase();
  const realtimeManager = useMemo(() => createRealtimeManager(supabase), [supabase]);

  const setTyping = useCallback(
    async (conversationId: string, userId: string, user: UserBasic) => {
      const channel = realtimeManager.getOrCreateChannel(conversationId);
      await channel.track({
        user_id: userId,
        user,
        typing: true,
        online_at: new Date().toISOString(),
      });
    },
    [realtimeManager]
  );

  const clearTyping = useCallback(
    async (conversationId: string, userId: string) => {
      const channel = realtimeManager.getOrCreateChannel(conversationId);
      await channel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    },
    [realtimeManager]
  );

  return { setTyping, clearTyping };
}

/**
 * Mark messages as read
 */
export function useMarkChatAsRead() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) {
        logError('markAsRead', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
