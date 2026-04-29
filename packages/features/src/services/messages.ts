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
     * Fetch all conversations for a user with members, last message, and unread count.
     *
     * Single PostgREST query via nested selects — replaces the previous 4-query approach.
     * Unread is derived from last_read_at vs last message timestamp, no extra scan needed.
     */
    async getConversations(userId: string): Promise<ConversationWithMembers[]> {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          last_read_at,
          joined_at,
          conversation:conversations!conversation_members_conversation_id_fkey(
            id, name, is_group, avatar_url, created_by, created_at, updated_at,
            members:conversation_members!conversation_members_conversation_id_fkey(
              last_read_at,
              joined_at,
              user:users!conversation_members_user_id_fkey(id, name, email, level, avatar_url)
            ),
            last_message:messages!messages_conversation_id_fkey(
              id, content, file_url, file_name, file_type, created_at, sender_id,
              sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url)
            )
          )
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      if (!data?.length) return [];

      interface RawMember {
        last_read_at: string;
        joined_at: string;
        user: UserBasic | null;
      }

      interface RawLastMessage {
        id: string;
        content: string | null;
        file_url: string | null;
        file_name: string | null;
        file_type: string | null;
        created_at: string;
        sender_id: string;
        sender: UserBasic | null;
      }

      interface RawConversation {
        id: string;
        name: string | null;
        is_group: boolean;
        avatar_url: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
        members: RawMember[];
        last_message: RawLastMessage | RawLastMessage[] | null;
      }

      interface RawRow {
        last_read_at: string;
        joined_at: string;
        conversation: RawConversation | null;
      }

      return (data as RawRow[])
        .filter((row): row is RawRow & { conversation: RawConversation } => row.conversation !== null)
        .map((row) => {
          const conv = row.conversation;

          const membersWithStatus: ConversationMemberWithUser[] = (conv.members || [])
            .filter((m): m is RawMember & { user: UserBasic } => m.user !== null)
            .map((m) => ({
              user: m.user,
              last_read_at: m.last_read_at,
              joined_at: m.joined_at,
            }));

          const members: UserBasic[] = membersWithStatus.map((m) => m.user);

          // PostgREST returns an array for to-many; we want only the latest message.
          // The DB trigger keeps conversations.updated_at current, so we sort on that
          // server-side. For last_message we just take the first element of the array.
          const rawLastMsg = Array.isArray(conv.last_message)
            ? conv.last_message[0] ?? null
            : conv.last_message;

          const lastMessage: MessageWithSender | null = rawLastMsg
            ? ({
                ...rawLastMsg,
                conversation_id: conv.id,
                reply_to_id: null,
                replyTo: null,
              } as unknown as MessageWithSender)
            : null;

          // Unread indicator: any message newer than our last_read_at, not sent by us.
          const myLastRead = row.last_read_at;
          const lastMsgTime = rawLastMsg?.created_at ?? null;
          const isUnread =
            lastMsgTime !== null &&
            rawLastMsg?.sender_id !== userId &&
            (myLastRead === null || lastMsgTime > myLastRead);

          return {
            id: conv.id,
            name: conv.name,
            is_group: conv.is_group,
            avatar_url: conv.avatar_url,
            created_by: conv.created_by,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            members,
            membersWithStatus,
            lastMessage,
            unreadCount: isUnread ? 1 : 0,
          } as ConversationWithMembers;
        })
        .sort((a, b) => {
          const aTime = a.lastMessage?.created_at ?? a.updated_at ?? '';
          const bTime = b.lastMessage?.created_at ?? b.updated_at ?? '';
          return bTime.localeCompare(aTime);
        });
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
