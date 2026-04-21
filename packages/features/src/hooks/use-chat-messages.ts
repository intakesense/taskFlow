'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Message,
  MessageWithSender,
  UserBasic,
  ConversationWithMembers,
} from '@taskflow/core';

import { useSupabase } from '../providers/services-context';
import { conversationKeys } from './use-conversations';
import { logError, getErrorMessage } from '../utils/error';

export const chatMessageKeys = {
  all: ['messages'] as const,
  conversation: (conversationId: string) => [...chatMessageKeys.all, conversationId] as const,
  search: (query: string) => [...chatMessageKeys.all, 'search', query] as const,
};

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
 * Subscribes to realtime messages, typing presence, and online status
 * for a conversation.
 *
 * Uses the Supabase client directly — no custom manager needed.
 * The client handles WebSocket reconnection automatically. Channels do NOT
 * auto-rejoin after a disconnect, so we recreate the channel on TIMED_OUT /
 * CHANNEL_ERROR with exponential backoff.
 *
 * worker:true on the client prevents background-tab heartbeat starvation
 * (the most common cause of TIMED_OUT when the app is idle).
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

  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; });

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setTypingUsers([]);
      setOnlineUserIds(new Set());
      return;
    }

    // One stable toast ID per conversation — Sonner replaces instead of stacking.
    const TOAST_ID = `rt-${conversationId}`;

    let channel: RealtimeChannel | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    interface PresenceState {
      user_id?: string;
      online_at?: string;
      typing?: boolean;
      user?: UserBasic;
    }

    const syncPresence = (ch: RealtimeChannel) => {
      const raw = ch.presenceState() as Record<string, unknown[]>;
      const typing: UserBasic[] = [];
      const online = new Set<string>();
      const staleThreshold = Date.now() - 5 * 60 * 1000;

      Object.values(raw).forEach((presences) => {
        (presences as PresenceState[]).forEach((p) => {
          if (!p.user_id || p.user_id === currentUserId) return;
          if (p.online_at && new Date(p.online_at).getTime() > staleThreshold) {
            online.add(p.user_id);
          }
          if (p.typing && p.user) typing.push(p.user);
        });
      });

      setTypingUsers(typing);
      setOnlineUserIds(online);
    };

    const handleNewMessage = async (payload: { new: Message }) => {
      const newMessage = payload.new;
      if (newMessage.sender_id === currentUserId) return;

      // Try cache first to avoid an extra round-trip
      let sender: UserBasic | null = null;
      for (const [, data] of queryClient.getQueriesData<ConversationWithMembers[]>({ queryKey: conversationKeys.all })) {
        const conv = data?.find((c) => c.id === conversationId);
        if (conv?.members) {
          sender = conv.members.find((m) => m.id === newMessage.sender_id) ?? null;
          if (sender) break;
        }
      }

      if (!sender) {
        const { data } = await supabase
          .from('users')
          .select('id, name, email, level, avatar_url')
          .eq('id', newMessage.sender_id)
          .single();
        sender = data as UserBasic;
      }

      const msg: MessageWithSender = { ...newMessage, sender, reactions: [] };
      queryClient.setQueryData<MessageWithSender[]>(
        chatMessageKeys.conversation(conversationId),
        (old = []) => (old.some((m) => m.id === msg.id) ? old : [...old, msg])
      );
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      onNewMessageRef.current?.(newMessage);
    };

    const subscribe = () => {
      if (destroyed) return;

      // Always remove the previous channel before creating a new one.
      // After TIMED_OUT / CHANNEL_ERROR the channel is dead and will not
      // self-recover — supabase-js only auto-reconnects the WebSocket transport,
      // not individual channels.
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          handleNewMessage
        )
        .on('presence', { event: 'sync' }, () => channel && syncPresence(channel))
        .subscribe((status) => {
          if (destroyed) return;

          if (status === 'SUBSCRIBED') {
            retryCount = 0;
            toast.dismiss(TOAST_ID);
            channel!
              .track({ user_id: currentUserId, online_at: new Date().toISOString() })
              .catch((err) => logError('presenceTrack', err));
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            if (retryCount < MAX_RETRIES) {
              const delay = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
              retryTimer = setTimeout(subscribe, delay);
              retryCount++;
            } else {
              logError('realtimeSubscription', { status, conversationId });
              if (document.visibilityState === 'visible') {
                toast.error('Connection lost. Messages may not update in real-time.', {
                  id: TOAST_ID,
                });
              }
            }
          }
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || destroyed) return;

      // Refetch to catch any messages missed while the tab was hidden.
      // Supabase has no event-replay mechanism so this is the only way to
      // guarantee consistency after a background disconnect.
      queryClient.invalidateQueries({ queryKey: chatMessageKeys.conversation(conversationId) });

      if (retryCount > 0) {
        // Connection was lost. Reconnect immediately rather than waiting for
        // the next backoff tick — the user is back so network is likely up.
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        retryCount = 0;
        toast.dismiss(TOAST_ID);
        subscribe();
      } else {
        // No error — just refresh our presence so we show as online again.
        channel
          ?.track({ user_id: currentUserId, online_at: new Date().toISOString() })
          .catch((err) => logError('presenceTrack.visibility', err));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    subscribe();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
      setTypingUsers([]);
      setOnlineUserIds(new Set());
    };
  }, [conversationId, currentUserId, queryClient, supabase]);

  const isUserOnline = useCallback(
    (userId: string): boolean => onlineUserIds.has(userId),
    [onlineUserIds]
  );

  return { typingUsers, onlineUserIds, isUserOnline, onlineCount: onlineUserIds.size };
}

/**
 * Sends typing presence on the conversation channel.
 * Reads the channel directly from the supabase client — no separate subscription.
 */
export function useSetTyping() {
  const supabase = useSupabase();

  const setTyping = useCallback(
    async (conversationId: string, userId: string, user: UserBasic) => {
      const channel = supabase.channel(`conversation:${conversationId}`);
      await channel
        .track({ user_id: userId, user, typing: true, online_at: new Date().toISOString() })
        .catch((err) => logError('setTyping', err));
    },
    [supabase]
  );

  const clearTyping = useCallback(
    async (conversationId: string, userId: string) => {
      const channel = supabase.channel(`conversation:${conversationId}`);
      await channel
        .track({ user_id: userId, online_at: new Date().toISOString() })
        .catch((err) => logError('clearTyping', err));
    },
    [supabase]
  );

  return { setTyping, clearTyping };
}

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
