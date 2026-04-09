import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  Database,
  Conversation,
  ConversationWithMembers,
  Message,
  MessageWithSender,
  UserBasic,
  ConversationMemberWithUser,
} from '@taskflow/core';

export interface CreateGroupInput {
  name: string;
  memberIds: string[];
}

export interface SendMessageInput {
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  replyToId?: string;
}

/**
 * Creates a messages/conversations service bound to a Supabase client.
 */
export function createMessagesService(supabase: SupabaseClient<Database>) {
  return {
    /**
     * Fetch all conversations for a user with members and last message.
     * Optimized: Uses 4 parallel queries instead of N+1.
     */
    async getConversations(userId: string): Promise<ConversationWithMembers[]> {
      // Step 1: Get conversation IDs
      const { data: memberOf, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (memberError) throw memberError;
      if (!memberOf?.length) return [];

      const conversationIds = memberOf.map(m => m.conversation_id);

      // Step 2: Fetch all data in parallel
      const [conversationsResult, membersResult, messagesResult, unreadMessagesResult] = await Promise.all([
        supabase
          .from('conversations')
          .select('*')
          .in('id', conversationIds)
          .order('updated_at', { ascending: false }),
        supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            last_read_at,
            joined_at,
            user:users!conversation_members_user_id_fkey(id, name, email, level, avatar_url)
          `)
          .in('conversation_id', conversationIds),
        supabase
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url)
          `)
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('messages')
          .select('conversation_id, created_at, sender_id')
          .in('conversation_id', conversationIds)
      ]);

      if (conversationsResult.error) throw conversationsResult.error;
      const conversations = conversationsResult.data || [];

      // Step 3: Build lookup maps
      const membersByConv = new Map<string, UserBasic[]>();
      const membersWithStatusByConv = new Map<string, ConversationMemberWithUser[]>();
      const lastMessageByConv = new Map<string, MessageWithSender>();
      const unreadCountByConv = new Map<string, number>();

      if (membersResult.data) {
        interface MemberItem {
          conversation_id: string;
          last_read_at: string;
          joined_at: string;
          user: UserBasic;
        }
        (membersResult.data as MemberItem[]).forEach((item) => {
          const convId = item.conversation_id;
          if (!membersByConv.has(convId)) {
            membersByConv.set(convId, []);
            membersWithStatusByConv.set(convId, []);
          }
          if (item.user) {
            membersByConv.get(convId)!.push(item.user);
            membersWithStatusByConv.get(convId)!.push({
              user: item.user,
              last_read_at: item.last_read_at,
              joined_at: item.joined_at,
            });
          }
        });
      }

      if (messagesResult.data) {
        (messagesResult.data as MessageWithSender[]).forEach((msg) => {
          if (!lastMessageByConv.has(msg.conversation_id)) {
            lastMessageByConv.set(msg.conversation_id, msg);
          }
        });
      }

      if (unreadMessagesResult.data) {
        const membershipMap = new Map(memberOf.map(m => [m.conversation_id, m.last_read_at]));

        interface UnreadItem { conversation_id: string; created_at: string; sender_id: string; }
        (unreadMessagesResult.data as UnreadItem[]).forEach((msg) => {
          const lastReadAt = membershipMap.get(msg.conversation_id);
          if (lastReadAt && msg.created_at > lastReadAt && msg.sender_id !== userId) {
            unreadCountByConv.set(
              msg.conversation_id,
              (unreadCountByConv.get(msg.conversation_id) || 0) + 1
            );
          }
        });
      }

      // Step 4: Combine
      return conversations.map((conv: Conversation) => ({
        ...conv,
        members: membersByConv.get(conv.id) || [],
        membersWithStatus: membersWithStatusByConv.get(conv.id) || [],
        lastMessage: lastMessageByConv.get(conv.id) || null,
        unreadCount: unreadCountByConv.get(conv.id) || 0,
      }));
    },

    /**
     * Get messages for a conversation.
     */
    async getMessages(conversationId: string): Promise<MessageWithSender[]> {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url),
          reply_to:messages!messages_reply_to_id_fkey(
            id, content,
            sender:users!messages_sender_id_fkey(id, name)
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as MessageWithSender[];
    },

    /**
     * Send a message to a conversation.
     */
    async sendMessage(conversationId: string, senderId: string, input: SendMessageInput): Promise<Message> {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
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

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data as Message;
    },

    /**
     * Create a DM conversation between two users.
     */
    async createDM(userId: string, otherUserId: string): Promise<Conversation> {
      const isSelfChat = userId === otherUserId;

      // Check for existing DM
      const { data: existing } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

      if (existing?.length) {
        for (const conv of existing) {
          const { data: members } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id);

          const expectedCount = isSelfChat ? 1 : 2;
          if (members?.length === expectedCount) {
            const memberIds = members.map(m => m.user_id);
            const isMatch = isSelfChat
              ? memberIds[0] === userId
              : memberIds.includes(otherUserId) && memberIds.includes(userId);

            if (isMatch) {
              const { data: convData } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conv.conversation_id)
                .eq('is_group', false)
                .single();

              if (convData) return convData;
            }
          }
        }
      }

      // Create new DM
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ created_by: userId, is_group: false })
        .select()
        .single();

      if (convError) throw convError;

      const membersToAdd = isSelfChat
        ? [{ conversation_id: newConv.id, user_id: userId }]
        : [
            { conversation_id: newConv.id, user_id: userId },
            { conversation_id: newConv.id, user_id: otherUserId },
          ];

      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert(membersToAdd);

      if (memberError) {
        await supabase.from('conversations').delete().eq('id', newConv.id);
        throw memberError;
      }

      return newConv;
    },

    /**
     * Create a group conversation.
     */
    async createGroup(userId: string, input: CreateGroupInput): Promise<Conversation> {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: input.name,
          created_by: userId,
          is_group: true,
        })
        .select()
        .single();

      if (convError) throw convError;

      const allMembers = [...new Set([userId, ...input.memberIds])];
      const { error: memberError } = await supabase
        .from('conversation_members')
        .insert(allMembers.map(id => ({ conversation_id: newConv.id, user_id: id })));

      if (memberError) {
        await supabase.from('conversations').delete().eq('id', newConv.id);
        throw memberError;
      }

      return newConv;
    },

    /**
     * Mark messages as read in a conversation.
     */
    async markAsRead(conversationId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
    },

    /**
     * Update group name.
     */
    async updateGroupName(conversationId: string, name: string): Promise<void> {
      const { error } = await supabase
        .from('conversations')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;
    },

    /**
     * Add members to a group.
     */
    async addGroupMembers(conversationId: string, memberIds: string[]): Promise<void> {
      const { error } = await supabase
        .from('conversation_members')
        .insert(memberIds.map(userId => ({
          conversation_id: conversationId,
          user_id: userId,
        })));

      if (error) throw error;
    },

    /**
     * Remove a member from a group.
     */
    async removeGroupMember(conversationId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
    },

    /**
     * Update group avatar URL.
     */
    async updateGroupAvatar(conversationId: string, avatarUrl: string | null): Promise<void> {
      const { error } = await supabase
        .from('conversations')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;
    },

    /**
     * Upload a group avatar and update the conversation.
     */
    async uploadGroupAvatar(conversationId: string, file: File): Promise<string> {
      const fileExt = file.name.split('.').pop();
      const fileName = `${conversationId}-${Date.now()}.${fileExt}`;
      const filePath = `group-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the conversation with the new avatar URL
      await supabase
        .from('conversations')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return publicUrl;
    },

    /**
     * Subscribe to new messages in a conversation.
     */
    subscribeToMessages(
      conversationId: string,
      callback: (message: MessageWithSender) => void
    ): RealtimeChannel {
      return supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => callback(payload.new as MessageWithSender)
        )
        .subscribe();
    },

    /**
     * Unsubscribe from a channel.
     */
    unsubscribe(channel: RealtimeChannel): void {
      supabase.removeChannel(channel);
    },
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
