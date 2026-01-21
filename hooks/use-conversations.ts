// useConversations - OPTIMIZED: Fixed N+1 query problem
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Conversation, ConversationWithMembers, UserBasic, MessageWithSender } from '@/lib/types';

const supabase = createClient();

// Query keys
export const conversationKeys = {
    all: ['conversations'] as const,
    list: () => [...conversationKeys.all, 'list'] as const,
    detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
};

// OPTIMIZED: Reduced from 50+ queries to 4 queries total
async function fetchConversations(userId: string): Promise<ConversationWithMembers[]> {
    // Step 1: Get conversation IDs and membership data
    const { data: memberOf, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

    if (memberError) throw memberError;
    if (!memberOf?.length) return [];

    const conversationIds = memberOf.map(m => m.conversation_id);

    // Step 2: Fetch ALL data in parallel (4 queries instead of N queries)
    const [conversationsResult, membersResult, messagesResult, unreadMessagesResult] = await Promise.all([
        // Query 1: Get all conversations
        supabase
            .from('conversations')
            .select('*')
            .in('id', conversationIds)
            .order('updated_at', { ascending: false }),

        // Query 2: Get ALL members for ALL conversations with user details
        supabase
            .from('conversation_members')
            .select(`
                conversation_id,
                user:users!conversation_members_user_id_fkey(id, name, email, level)
            `)
            .in('conversation_id', conversationIds),

        // Query 3: Get last message for EACH conversation
        supabase
            .from('messages')
            .select(`
                *,
                sender:users!messages_sender_id_fkey(id, name, email, level)
            `)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false }),

        // Query 4: Get unread messages count data
        supabase
            .from('messages')
            .select('conversation_id, created_at, sender_id')
            .in('conversation_id', conversationIds)
    ]);

    if (conversationsResult.error) throw conversationsResult.error;
    const conversations = conversationsResult.data || [];

    // Step 3: Build lookup maps for O(1) access (instead of nested loops)
    const membersByConv = new Map<string, UserBasic[]>();
    const lastMessageByConv = new Map<string, MessageWithSender>();
    const unreadCountByConv = new Map<string, number>();

    // Process members data
    if (membersResult.data) {
        membersResult.data.forEach((item: any) => {
            const convId = item.conversation_id;
            const user = item.user as UserBasic;
            if (!membersByConv.has(convId)) {
                membersByConv.set(convId, []);
            }
            if (user) {
                membersByConv.get(convId)!.push(user);
            }
        });
    }

    // Process last messages
    if (messagesResult.data) {
        messagesResult.data.forEach((msg: any) => {
            // Only keep the first (most recent) message per conversation
            if (!lastMessageByConv.has(msg.conversation_id)) {
                lastMessageByConv.set(msg.conversation_id, msg as MessageWithSender);
            }
        });
    }

    // Calculate unread counts
    if (unreadMessagesResult.data) {
        const membershipMap = new Map(memberOf.map(m => [m.conversation_id, m.last_read_at]));

        unreadMessagesResult.data.forEach((msg: any) => {
            const lastReadAt = membershipMap.get(msg.conversation_id);
            // Count messages sent after last read by other users
            if (lastReadAt && msg.created_at > lastReadAt && msg.sender_id !== userId) {
                unreadCountByConv.set(
                    msg.conversation_id,
                    (unreadCountByConv.get(msg.conversation_id) || 0) + 1
                );
            }
        });
    }

    // Step 4: Combine everything efficiently
    const enriched: ConversationWithMembers[] = conversations.map((conv) => ({
        ...conv,
        members: membersByConv.get(conv.id) || [],
        lastMessage: lastMessageByConv.get(conv.id) || null,
        unreadCount: unreadCountByConv.get(conv.id) || 0,
    }));

    return enriched;
}

// Create a DM conversation
async function createDMConversation(userId: string, otherUserId: string): Promise<Conversation> {
    console.log('🔍 Creating DM between', userId, 'and', otherUserId);

    // Check if DM already exists
    const { data: existing, error: existingError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

    if (existingError) {
        console.error('❌ Error checking existing DMs:', existingError);
        throw new Error(`Failed to check existing conversations: ${existingError.message}`);
    }

    if (existing?.length) {
        console.log('📋 Found', existing.length, 'existing conversations to check');
        for (const conv of existing) {
            const { data: members, error: membersError } = await supabase
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', conv.conversation_id);

            if (membersError) {
                console.error('❌ Error fetching members:', membersError);
                continue;
            }

            if (members?.length === 2) {
                const memberIds = members.map(m => m.user_id);
                if (memberIds.includes(otherUserId)) {
                    console.log('✅ Found existing DM:', conv.conversation_id);
                    const { data: convData, error: convError } = await supabase
                        .from('conversations')
                        .select('*')
                        .eq('id', conv.conversation_id)
                        .eq('is_group', false)
                        .single();

                    if (convError) {
                        console.error('❌ Error fetching conversation:', convError);
                        continue;
                    }
                    if (convData) return convData;
                }
            }
        }
    }

    console.log('➕ Creating new DM conversation');
    // Create new DM
    const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ created_by: userId, is_group: false })
        .select()
        .single();

    if (convError) {
        console.error('❌ Error creating conversation:', convError);
        throw new Error(`Failed to create conversation: ${convError.message} (${convError.code})`);
    }

    console.log('✅ Created conversation:', newConv.id);

    // Add both members
    console.log('➕ Adding members to conversation');
    const { error: memberError } = await supabase
        .from('conversation_members')
        .insert([
            { conversation_id: newConv.id, user_id: userId },
            { conversation_id: newConv.id, user_id: otherUserId },
        ]);

    if (memberError) {
        console.error('❌ Error adding members:', memberError);
        // Try to clean up the orphaned conversation
        await supabase.from('conversations').delete().eq('id', newConv.id);
        throw new Error(`Failed to add members: ${memberError.message} (${memberError.code})`);
    }

    console.log('✅ Successfully created DM with both members');
    return newConv;
}

// Create a group conversation
interface CreateGroupInput {
    name: string;
    memberIds: string[];
}

async function createGroupConversation(userId: string, input: CreateGroupInput): Promise<Conversation> {
    console.log('🔍 Creating group:', input.name, 'with members:', input.memberIds);

    const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
            name: input.name,
            created_by: userId,
            is_group: true,
        })
        .select()
        .single();

    if (convError) {
        console.error('❌ Error creating group conversation:', convError);
        throw new Error(`Failed to create group: ${convError.message} (${convError.code})`);
    }

    console.log('✅ Created group conversation:', newConv.id);

    const allMembers = [...new Set([userId, ...input.memberIds])];
    console.log('➕ Adding', allMembers.length, 'members to group');

    const { error: memberError } = await supabase
        .from('conversation_members')
        .insert(allMembers.map(id => ({ conversation_id: newConv.id, user_id: id })));

    if (memberError) {
        console.error('❌ Error adding members to group:', memberError);
        // Try to clean up the orphaned conversation
        await supabase.from('conversations').delete().eq('id', newConv.id);
        throw new Error(`Failed to add members to group: ${memberError.message} (${memberError.code})`);
    }

    console.log('✅ Successfully created group with all members');
    return newConv;
}

// Hooks
export function useConversations(userId: string | undefined) {
    return useQuery({
        queryKey: conversationKeys.list(),
        queryFn: () => fetchConversations(userId!),
        enabled: !!userId,
        // Use default retry and staleTime from QueryProvider
    });
}

export function useCreateDM() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, otherUserId }: { userId: string; otherUserId: string }) =>
            createDMConversation(userId, otherUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conversationKeys.all });
        },
    });
}

export function useCreateGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, input }: { userId: string; input: CreateGroupInput }) =>
            createGroupConversation(userId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: conversationKeys.all });
        },
    });
}

// Realtime subscription
export function useConversationsRealtime(userId: string | undefined) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;

        // Debounce invalidations to prevent query storms
        let invalidateTimeout: NodeJS.Timeout | null = null;
        const debouncedInvalidate = () => {
            if (invalidateTimeout) clearTimeout(invalidateTimeout);
            invalidateTimeout = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
            }, 300);
        };

        const channel = supabase
            .channel('conversations-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                debouncedInvalidate
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations' },
                debouncedInvalidate
            )
            .subscribe();

        return () => {
            if (invalidateTimeout) clearTimeout(invalidateTimeout);
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient]);
}
