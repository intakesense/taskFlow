// useChatMessages - Message operations with React Query
// OPTIMIZED: Fixed channel leaks, N+1 queries, and infinite loops
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Message, MessageWithSender, UserBasic, ConversationWithMembers } from '@/lib/types'
import { conversationKeys } from './use-conversations'
import { realtimeManager } from '@/lib/realtime-manager'
import { logError, getErrorMessage } from '@/lib/utils/error'

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
      sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url),
      reactions:message_reactions(
        id,
        emoji,
        user_id,
        created_at,
        user:users!message_reactions_user_id_fkey(id, name, email, level, avatar_url)
      )
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    logError('fetchMessages', error)
    // Fallback without joins if the join fails
    const { data: messagesOnly, error: fallbackError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (fallbackError) {
      logError('fetchMessages.fallback', fallbackError)
      throw fallbackError
    }
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
      sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url)
    `)
    .single()

  if (error) {
    logError('sendMessage', error)
    throw new Error(`Failed to send message: ${error.message}`)
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
      sender:users!messages_sender_id_fkey(id, name, email, level, avatar_url)
    `)
    .textSearch('search_vector', query)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    logError('searchMessages', error)
    throw error
  }
  return data as MessageWithSender[]
}

// Mark messages as read
async function markAsRead(conversationId: string, userId: string): Promise<void> {
  // Update last_read_at in conversation_members
  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (error) {
    logError('markAsRead', error)
    throw error
  }
}

// Delete message (soft delete)
async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId)

  if (error) {
    logError('deleteMessage', error)
    throw error
  }
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

      // Generate a stable key that will be preserved when temp message becomes real
      const stableKey = `${variables.conversationId}-${Date.now()}-${Math.random()}`

      // Optimistically update with temp message
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
        sender: null, // Will be populated by realtime
        reactions: [], // New messages have no reactions
        _stableKey: stableKey, // Stable key for React reconciliation
      }

      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(variables.conversationId),
        (old = []) => [...old, optimisticMessage]
      )

      return { previousMessages, stableKey }
    },
    onError: (err, variables, context) => {
      // Error already logged in service layer
      toast.error(getErrorMessage(err, 'Failed to send message'))

      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messageKeys.conversation(variables.conversationId),
          context.previousMessages
        )
      }
    },
    onSuccess: (newMessage, variables, context) => {
      console.log('✅ Message sent successfully:', newMessage.id)

      // Replace temp message with real one IN-PLACE, preserving stable key
      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(variables.conversationId),
        (old = []) => {
          // Find the temp message index
          const tempIndex = old.findIndex((msg) => msg.id.startsWith('temp-'))

          if (tempIndex !== -1) {
            // Replace temp message with real one at the same position, preserving stable key
            const newMessages = [...old]
            newMessages[tempIndex] = {
              ...newMessage,
              _stableKey: context?.stableKey, // Preserve the stable key
            } as MessageWithSender
            return newMessages
          }

          // Fallback: if no temp message (shouldn't happen), check for duplicates
          const exists = old.some((msg) => msg.id === newMessage.id)
          return exists ? old : [...old, { ...newMessage, _stableKey: context?.stableKey } as MessageWithSender]
        }
      )

      // Only invalidate conversation list (for last message preview), not all messages
      queryClient.invalidateQueries({ queryKey: conversationKeys.all })
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
      queryClient.invalidateQueries({ queryKey: conversationKeys.all })
    },
    onError: (error) => {
      // Don't show toast for this - it's a background operation
      // But still log for debugging
      logError('useMarkAsRead', error)
    },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      // Only invalidate affected queries, not all messages
      queryClient.invalidateQueries({ queryKey: messageKeys.all })
    },
    onError: (error) => {
      // Error already logged in service layer
      toast.error(getErrorMessage(error, 'Failed to delete message'))
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset state when conversation deselected
      setTypingUsers([])
      setOnlineUserIds(new Set())
      return
    }

    console.log(`⚙️ Setting up realtime for conversation: ${conversationId}`)

    // --- Reconnect state (mutable, lives for the lifetime of this effect) ---
    let retryCount = 0
    const MAX_RETRIES = 3
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let isCleanedup = false
    // Track whether the last subscribe callback reported an error,
    // so the visibility-change handler knows whether to force-reconnect
    // without inspecting private Supabase channel internals.
    let hadChannelError = false

    // --- Handler for incoming messages ---
    const handleNewMessage = async (payload: { new: Message }) => {
      const newMessage = payload.new

      // Only process messages for THIS conversation
      if (newMessage.conversation_id !== conversationId) return

      // Skip own messages — handled optimistically by the mutation's onSuccess
      if (newMessage.sender_id === currentUserId) return

      // Try to resolve sender from React Query cache first (avoids an extra DB round-trip)
      let sender: UserBasic | null = null
      const allCachedConvs = queryClient.getQueriesData<ConversationWithMembers[]>({ queryKey: conversationKeys.all })
      for (const [, conversationsData] of allCachedConvs) {
        if (!conversationsData) continue
        const conversation = conversationsData.find((c) => c.id === conversationId)
        if (conversation?.members) {
          sender = conversation.members.find((m: UserBasic) => m.id === newMessage.sender_id) || null
          if (sender) break
        }
      }

      // Fallback: fetch sender from DB
      if (!sender) {
        const { data: senderData } = await supabase
          .from('users')
          .select('id, name, email, level, avatar_url')
          .eq('id', newMessage.sender_id)
          .single()
        sender = senderData as UserBasic
      }

      const messageWithSender: MessageWithSender = { ...newMessage, sender, reactions: [] }

      queryClient.setQueryData<MessageWithSender[]>(
        messageKeys.conversation(conversationId),
        (old = []) => old.some((msg) => msg.id === messageWithSender.id) ? old : [...old, messageWithSender]
      )
      queryClient.invalidateQueries({ queryKey: conversationKeys.all })
      onNewMessageRef.current?.(newMessage)
    }

    // --- Presence helpers ---
    interface PresenceState {
      user_id?: string
      online_at?: string
      typing?: boolean
      user?: UserBasic
    }

    // Pure function — takes the current presence state map and returns derived UI state.
    // Extracted to avoid writing the same parse logic twice.
    const parsePresenceState = (
      rawState: Record<string, unknown[]>
    ): { typing: UserBasic[]; online: Set<string> } => {
      const typing: UserBasic[] = []
      const online = new Set<string>()
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

      Object.values(rawState).forEach((presences) => {
        (presences as PresenceState[]).forEach((p) => {
          if (!p.user_id || p.user_id === currentUserId) return
          if (p.online_at && new Date(p.online_at).getTime() > fiveMinutesAgo) {
            online.add(p.user_id)
          }
          if (p.typing && p.user) typing.push(p.user)
        })
      })

      return { typing, online }
    }

    const syncPresence = (channel: ReturnType<typeof realtimeManager.getOrCreateChannel>) => {
      const { typing, online } = parsePresenceState(
        channel.presenceState() as Record<string, unknown[]>
      )
      setTypingUsers(typing)
      setOnlineUserIds(online)
    }

    // --- Channel setup (called on first mount and on each reconnect attempt) ---
    const setupChannel = () => {
      if (isCleanedup) return

      // Use the manager's reconnect helper — it force-removes the stale channel
      // and returns a fresh one via getOrCreateChannel.
      const ch = realtimeManager.reconnectChannel(conversationId)

      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        handleNewMessage
      )
      ch.on('presence', { event: 'sync' }, () => syncPresence(ch))

      ch.subscribe((status) => {
        if (isCleanedup) return

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime connected: ${conversationId}`)
          retryCount = 0
          hadChannelError = false
          ch.track({ user_id: currentUserId, online_at: new Date().toISOString() })
            .catch((err) => logError('presenceTrack', err))
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          hadChannelError = true
          console.warn(`⚠️ Realtime ${status} (attempt ${retryCount + 1}/${MAX_RETRIES}): ${conversationId}`)

          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount + 1) * 1000 // 2s → 4s → 8s
            retryCount++
            console.log(`🔄 Reconnecting in ${delay / 1000}s...`)
            retryTimeout = setTimeout(setupChannel, delay)
          } else {
            logError('realtimeSubscription', { status, conversationId })
            toast.error('Connection lost. Messages may not update in real-time.')
          }
        }
      })

      realtimeManager.markAsConfigured(conversationId)

      // Track own presence
      ch.track({ user_id: currentUserId, online_at: new Date().toISOString() })
        .catch((err) => logError('presenceTrack', err))
    }

    // --- Initial mount ---
    if (!realtimeManager.isChannelConfigured(conversationId)) {
      setupChannel()
    } else {
      // Another component is already using this channel — reuse it
      console.log(`♻️ Reusing existing channel: ${conversationId}`)
      const ch = realtimeManager.getOrCreateChannel(conversationId)
      syncPresence(ch)
      ch.track({ user_id: currentUserId, online_at: new Date().toISOString() })
        .catch((err) => logError('presenceTrack', err))
    }

    // --- Reconnect when tab becomes visible again ---
    // Browsers suspend WebSocket keepalives when a tab is backgrounded;
    // Supabase can drop the connection. On returning we check if we had an error
    // and, if so, restart from scratch. If the connection is fine, we simply
    // re-track presence (it may have expired while hidden).
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || isCleanedup) return
      console.log('👁️ Tab visible — verifying realtime connection')

      // Always refetch messages to catch anything sent while the WebSocket was dead.
      // This is the key difference vs pure realtime — missed messages are backfilled silently.
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(conversationId) })

      if (hadChannelError) {
        console.log('🔄 Previous error detected — forcing reconnect')
        if (retryTimeout) clearTimeout(retryTimeout)
        retryCount = 0
        setupChannel()
      } else {
        // Channel is healthy — just refresh presence (it may have expired while hidden)
        const ch = realtimeManager.getOrCreateChannel(conversationId)
        ch.track({ user_id: currentUserId, online_at: new Date().toISOString() })
          .catch((err) => logError('presenceTrack.visibility', err))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      console.log(`🔌 Cleaning up conversation: ${conversationId}`)
      isCleanedup = true

      // Cancel any pending retry
      if (retryTimeout) clearTimeout(retryTimeout)

      document.removeEventListener('visibilitychange', handleVisibilityChange)

      // Clear state
      setTypingUsers([])
      setOnlineUserIds(new Set())

      // Clear presence for current user
      const ch = realtimeManager.getOrCreateChannel(conversationId)
      ch.untrack().catch((err) => logError('presenceUntrack', err))

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
export function useMessagesRealtime() {
  console.warn('useMessagesRealtime is deprecated. Use useConversationRealtime instead.')
  // No-op, functionality moved to useConversationRealtime
}

export function useTypingIndicator() {
  console.warn('useTypingIndicator is deprecated. Use useConversationRealtime instead.')
  return []
}
