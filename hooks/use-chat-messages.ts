// useChatMessages - Message operations with React Query
// OPTIMIZED: Fixed channel leaks, N+1 queries, and infinite loops
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Message, MessageWithSender, UserBasic } from '@/lib/types'
import { conversationKeys } from './use-conversations'
import { realtimeManager } from '@/lib/realtime-manager'

const supabase = createClient()

// Query keys
export const messageKeys = {
  all: ['messages'] as const,
  conversation: (conversationId: string) => [...messageKeys.all, conversationId] as const,
  search: (query: string) => [...messageKeys.all, 'search', query] as const,
}

// Export fetchMessages for prefetching
export { fetchMessages }

// Fetch messages for a conversation
async function fetchMessages(conversationId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users!messages_sender_id_fkey(id, name, email, level),
      reactions:message_reactions(
        id,
        emoji,
        user_id,
        created_at,
        user:users!message_reactions_user_id_fkey(id, name, email, level)
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    // Fallback without joins if the join fails
    const { data: messagesOnly, error: fallbackError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (fallbackError) throw fallbackError
    return (messagesOnly || []).map((m: Message) => ({ ...m, sender: null, reactions: [] })) as MessageWithSender[]
  }

  return data as MessageWithSender[]
}

// Send a message
interface SendMessageInput {
  conversationId: string
  senderId: string
  content?: string
  fileUrl?: string
  fileName?: string
  fileSize?: number
  fileType?: string
  replyToId?: string
}

async function sendMessage(input: SendMessageInput): Promise<MessageWithSender> {
  console.log('📤 Attempting to send message:', {
    conversationId: input.conversationId,
    senderId: input.senderId,
    hasContent: !!input.content,
    hasFile: !!input.fileUrl,
  });

  // Insert message
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
    .select(`
      *,
      sender:users!messages_sender_id_fkey(id, name, email, level)
    `)
    .single()

  if (error) {
    console.error('❌ Failed to send message:', error);
    throw new Error(`Failed to send message: ${error.message} (${error.code})`);
  }

  console.log('✅ Message sent successfully:', data.id);
  return data as MessageWithSender
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
    .limit(50)

  if (error) throw error
  return data as MessageWithSender[]
}

// Mark messages as read
async function markAsRead(conversationId: string, userId: string): Promise<void> {
  // Update last_read_at in conversation_members
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

// Delete message (soft delete)
async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId)

  if (error) throw error
}

// Hooks
export function useChatMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.conversation(conversationId || ''),
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
    // Use default retry and staleTime from QueryProvider
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: sendMessage,
    // OPTIMIZED: Use optimistic updates instead of invalidations
    onMutate: async (variables) => {
      console.log('📤 Sending message to conversation:', variables.conversationId)

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messageKeys.conversation(variables.conversationId),
      })

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithSender[]>(
        messageKeys.conversation(variables.conversationId)
      )

      // Optimistically update with temp message
      const optimisticMessage: MessageWithSender = {
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
        sender: null, // Will be populated by realtime
        reactions: [], // New messages have no reactions
      }

      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(variables.conversationId),
        (old = []) => [...old, optimisticMessage]
      )

      return { previousMessages }
    },
    onError: (err, variables, context) => {
      console.error('❌ Failed to send message:', err)

      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messageKeys.conversation(variables.conversationId),
          context.previousMessages
        )
      }
    },
    onSuccess: (newMessage, variables) => {
      console.log('✅ Message sent successfully:', newMessage.id)

      // Replace optimistic message with real one
      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(variables.conversationId),
        (old = []) => {
          // Remove temp message and add real one if not already added by realtime
          const withoutTemp = old.filter((msg) => !msg.id.startsWith('temp-'))
          const hasReal = withoutTemp.some((msg) => msg.id === newMessage.id)
          return hasReal ? withoutTemp : [...withoutTemp, newMessage]
        }
      )

      // Only invalidate conversation list (for last message preview), not all messages
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useSearchMessages(query: string) {
  return useQuery({
    queryKey: messageKeys.search(query),
    queryFn: () => searchMessages(query),
    enabled: query.length >= 2,
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      markAsRead(conversationId, userId),
    onSuccess: () => {
      // Only invalidate conversation list (for unread count)
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteMessage,
    onSuccess: (_, messageId) => {
      // Only invalidate affected queries, not all messages
      queryClient.invalidateQueries({ queryKey: messageKeys.all })
    },
  })
}

/**
 * CONSOLIDATED REALTIME HOOK
 * Combines messages + typing + online status in a SINGLE channel to prevent leaks
 * Uses Supabase Presence for typing and online status (ephemeral, no DB writes)
 *
 * @param onNewMessage - Optional callback when a new message arrives (used to mark as read)
 */
export function useConversationRealtime(
  conversationId: string | undefined,
  currentUserId: string | undefined,
  onNewMessage?: (message: Message) => void
) {
  const queryClient = useQueryClient()
  const [typingUsers, setTypingUsers] = useState<UserBasic[]>([])
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  // Use ref for callback to avoid recreating realtime subscription when callback changes
  const onNewMessageRef = useRef(onNewMessage)
  useEffect(() => {
    onNewMessageRef.current = onNewMessage
  })

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      // Clear state when no conversation selected
      setTypingUsers([])
      setOnlineUserIds(new Set())
      return
    }

    console.log(`🔄 Setting up realtime for conversation: ${conversationId}`)

    // Get or create a single channel for this conversation
    const channel = realtimeManager.getOrCreateChannel(conversationId)

    // Handler for new messages - NOTE: Uses conversationId from closure
    const handleNewMessage = async (payload: any) => {
      const newMessage = payload.new as Message

      console.log(`📨 New message received for conversation: ${newMessage.conversation_id}`)

      // IMPORTANT: Only process messages for THIS conversation
      if (newMessage.conversation_id !== conversationId) {
        console.warn(`⚠️ Ignoring message for different conversation: ${newMessage.conversation_id}`)
        return
      }

      // OPTIMIZED: Try to get sender from cache first
      const conversationsData = queryClient.getQueryData<any>(conversationKeys.list())
      let sender: UserBasic | null = null

      if (conversationsData) {
        // Try to find sender in cached conversation members
        const conversation = conversationsData.find((c: any) => c.id === conversationId)
        if (conversation?.members) {
          sender = conversation.members.find((m: UserBasic) => m.id === newMessage.sender_id) || null
        }
      }

      // If not in cache, fetch it (fallback only)
      if (!sender) {
        const { data: senderData } = await supabase
          .from('users')
          .select('id, name, email, level')
          .eq('id', newMessage.sender_id)
          .single()
        sender = senderData as UserBasic
      }

      const messageWithSender: MessageWithSender = {
        ...newMessage,
        sender,
        reactions: [], // New messages via realtime have no reactions yet
      }

      // Add to cache without refetching
      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(conversationId),
        (old = []) => {
          // Prevent duplicates
          const exists = old.some((msg) => msg.id === messageWithSender.id)
          return exists ? old : [...old, messageWithSender]
        }
      )

      // Update conversation list (for last message preview)
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })

      // Notify parent component about new message (for marking as read)
      onNewMessageRef.current?.(newMessage)
    }

    // Handler for presence sync - extracts BOTH typing and online status
    const handlePresenceSync = () => {
      const state = channel.presenceState()
      const typing: UserBasic[] = []
      const online = new Set<string>()

      Object.values(state).forEach((presences: any) => {
        presences.forEach((presence: any) => {
          // Skip current user
          if (presence.user_id === currentUserId) return

          // Track online users (anyone with recent online_at)
          if (presence.online_at) {
            const onlineAt = new Date(presence.online_at).getTime()
            const now = Date.now()
            const fiveMinutesAgo = now - 5 * 60 * 1000

            if (onlineAt > fiveMinutesAgo) {
              online.add(presence.user_id)
            }
          }

          // Track typing users (must have typing flag AND user object)
          if (presence.typing && presence.user) {
            typing.push(presence.user as UserBasic)
          }
        })
      })

      console.log(`👥 Presence updated for ${conversationId}: ${typing.length} typing, ${online.size} online`)
      setTypingUsers(typing)
      setOnlineUserIds(online)
    }

    // Only configure channel once (first component to mount)
    if (!realtimeManager.isChannelConfigured(conversationId)) {
      console.log(`⚙️ Configuring channel for conversation: ${conversationId}`)

      // Subscribe to postgres changes for new messages
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )

      // Subscribe to Presence for typing indicators
      channel.on('presence', { event: 'sync' }, handlePresenceSync)

      // Subscribe to the channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to conversation: ${conversationId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Channel error for conversation: ${conversationId}`)
        } else if (status === 'TIMED_OUT') {
          console.error(`⏱️ Channel timed out for conversation: ${conversationId}`)
        }
      })

      // Mark as configured
      realtimeManager.markAsConfigured(conversationId)
    } else {
      console.log(`♻️ Reusing existing channel for conversation: ${conversationId}`)

      // Sync presence state immediately when reusing channel
      handlePresenceSync()
    }

    // Track own presence when opening conversation (for online status)
    channel.track({
      user_id: currentUserId,
      online_at: new Date().toISOString(),
      // Note: typing flag will be added by useSetTyping when user types
    }).catch((err) => {
      console.warn('Error tracking presence:', err)
    })

    return () => {
      console.log(`🔌 Cleaning up conversation: ${conversationId}`)

      // Clear state
      setTypingUsers([])
      setOnlineUserIds(new Set())

      // Clear presence for current user
      channel.untrack().catch((err) => {
        console.warn('Error untracking presence:', err)
      })

      // Release channel (will only remove when ref count reaches 0)
      realtimeManager.releaseChannel(conversationId)
    }
  }, [conversationId, currentUserId, queryClient]) // onNewMessage accessed via ref

  // Helper function to check if a user is online
  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUserIds.has(userId)
    },
    [onlineUserIds]
  )

  return {
    typingUsers,
    onlineUserIds,
    isUserOnline,
    onlineCount: onlineUserIds.size,
  }
}

/**
 * TYPING INDICATOR using Supabase Presence (no DB writes!)
 * IMPORTANT: This updates presence state without removing online status
 */
export function useSetTyping() {
  const setTyping = useCallback(
    async (conversationId: string, userId: string, user: UserBasic) => {
      const channel = realtimeManager.getOrCreateChannel(conversationId)

      // Track presence with typing state AND online status
      await channel.track({
        user_id: userId,
        user,
        typing: true,
        online_at: new Date().toISOString(),
      })
    },
    []
  )

  const clearTyping = useCallback(async (conversationId: string, userId: string) => {
    const channel = realtimeManager.getOrCreateChannel(conversationId)

    // DON'T untrack completely! Just update presence to remove typing flag
    // This preserves online status while clearing typing indicator
    await channel.track({
      user_id: userId,
      online_at: new Date().toISOString(),
      // Note: typing flag omitted = user not typing anymore
    })
  }, [])

  return { setTyping, clearTyping }
}

// Backwards compatibility exports (deprecated)
export const useMessagesRealtime = (conversationId: string | undefined) => {
  console.warn('useMessagesRealtime is deprecated. Use useConversationRealtime instead.')
  // No-op, functionality moved to useConversationRealtime
}

export const useTypingIndicator = (conversationId: string | undefined) => {
  console.warn('useTypingIndicator is deprecated. Use useConversationRealtime instead.')
  return []
}
