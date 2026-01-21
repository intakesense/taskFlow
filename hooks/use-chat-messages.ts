// useChatMessages - Message operations with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, MessageWithSender, UserBasic } from '@/lib/types';
import { conversationKeys } from './use-conversations';

const supabase = createClient();

// Query keys
export const messageKeys = {
    all: ['messages'] as const,
    conversation: (conversationId: string) => [...messageKeys.all, conversationId] as const,
    search: (query: string) => [...messageKeys.all, 'search', query] as const,
};

// Fetch messages for a conversation
async function fetchMessages(conversationId: string): Promise<MessageWithSender[]> {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email, level)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

    if (error) {
        // Fallback without joins if the join fails
        const { data: messagesOnly, error: fallbackError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (fallbackError) throw fallbackError;
        return (messagesOnly || []).map(m => ({ ...m, sender: null })) as MessageWithSender[];
    }

    return data as MessageWithSender[];
}

// Send a message
interface SendMessageInput {
    conversationId: string;
    senderId: string;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    replyToId?: string;
}

async function sendMessage(input: SendMessageInput): Promise<Message> {
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
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Search messages
async function searchMessages(query: string): Promise<MessageWithSender[]> {
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email, level)
        `)
        .textSearch('search_vector', query)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;
    return data as MessageWithSender[];
}

// Mark messages as read
async function markAsRead(conversationId: string, userId: string): Promise<void> {
    // Update last_read_at in conversation_members
    await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
}

// Delete message (soft delete)
async function deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
        .from('messages')
        .update({ is_deleted: true, content: null })
        .eq('id', messageId);

    if (error) throw error;
}

// Hooks
export function useChatMessages(conversationId: string | undefined) {
    return useQuery({
        queryKey: messageKeys.conversation(conversationId || ''),
        queryFn: () => fetchMessages(conversationId!),
        enabled: !!conversationId,
        // Use default retry and staleTime from QueryProvider
    });
}

export function useSendMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: sendMessage,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: messageKeys.conversation(variables.conversationId) });
            queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
        },
    });
}

export function useSearchMessages(query: string) {
    return useQuery({
        queryKey: messageKeys.search(query),
        queryFn: () => searchMessages(query),
        enabled: query.length >= 2,
    });
}

export function useMarkAsRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
            markAsRead(conversationId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
        },
    });
}

export function useDeleteMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteMessage,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: messageKeys.all });
        },
    });
}

// Realtime subscription for new messages
export function useMessagesRealtime(conversationId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!conversationId) return;

        const channel = supabase
            .channel(`messages-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                async (payload) => {
                    // Fetch sender info for the new message
                    const { data: sender } = await supabase
                        .from('users')
                        .select('id, name, email, level')
                        .eq('id', payload.new.sender_id)
                        .single();

                    const newMessage: MessageWithSender = {
                        ...(payload.new as Message),
                        sender: sender as UserBasic,
                    };

                    // Add to cache
                    queryClient.setQueryData<MessageWithSender[]>(
                        messageKeys.conversation(conversationId),
                        (old = []) => [...old, newMessage]
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, queryClient]);
}

// Typing indicator hooks
export function useTypingIndicator(conversationId: string | undefined) {
    const [typingUsers, setTypingUsers] = useState<UserBasic[]>([]);

    useEffect(() => {
        if (!conversationId) return;

        const channel = supabase
            .channel(`typing-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'typing_status',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                async () => {
                    // Fetch current typing users
                    const { data: typingData } = await supabase
                        .from('typing_status')
                        .select('user_id')
                        .eq('conversation_id', conversationId)
                        .gt('updated_at', new Date(Date.now() - 5000).toISOString());

                    if (typingData?.length) {
                        const { data: users } = await supabase
                            .from('users')
                            .select('id, name, email, level')
                            .in('user_id', typingData.map(t => t.user_id));
                        setTypingUsers((users || []) as UserBasic[]);
                    } else {
                        setTypingUsers([]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId]);

    return typingUsers;
}

export function useSetTyping() {
    const setTyping = useCallback(async (conversationId: string, userId: string) => {
        await supabase
            .from('typing_status')
            .upsert({
                conversation_id: conversationId,
                user_id: userId,
                updated_at: new Date().toISOString(),
            });
    }, []);

    const clearTyping = useCallback(async (conversationId: string, userId: string) => {
        await supabase
            .from('typing_status')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
    }, []);

    return { setTyping, clearTyping };
}
