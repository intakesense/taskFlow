import { useEffect, useState, useCallback } from 'react'
import { realtimeManager } from '@/lib/realtime-manager'

/**
 * useOnlinePresence - Track online status of users in a conversation
 *
 * Uses Supabase Presence to track which users are currently viewing the conversation.
 * Presence is ephemeral (no database writes) and automatically cleared on disconnect.
 *
 * Users are considered "online" when they:
 * - Have the conversation open
 * - Have an active browser tab
 * - Are connected to the realtime channel
 *
 * @param conversationId - The conversation to track presence for
 * @param currentUserId - The current user's ID (excluded from results)
 * @param enabled - Whether presence tracking is enabled (default: true)
 * @returns Object with online users Set and helper functions
 */
export function useOnlinePresence(
  conversationId: string | undefined,
  currentUserId: string | undefined,
  enabled: boolean = true
) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  // Track own presence in the conversation
  const trackPresence = useCallback(async () => {
    if (!conversationId || !currentUserId || !enabled) return

    const channel = realtimeManager.getOrCreateChannel(conversationId)

    try {
      await channel.track({
        user_id: currentUserId,
        online_at: new Date().toISOString(),
        // Note: Don't set typing flag here - that's handled by useSetTyping
      })
      console.log(`👋 Tracking presence in conversation: ${conversationId}`)
    } catch (error) {
      console.error('Failed to track presence:', error)
    }
  }, [conversationId, currentUserId, enabled])

  // Clear own presence (when leaving conversation)
  const untrackPresence = useCallback(async () => {
    if (!conversationId) return

    const channel = realtimeManager.getOrCreateChannel(conversationId)

    try {
      await channel.untrack()
      console.log(`👋 Untracking presence in conversation: ${conversationId}`)
    } catch (error) {
      console.error('Failed to untrack presence:', error)
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !currentUserId || !enabled) {
      setOnlineUsers(new Set())
      return
    }

    console.log(`👥 Setting up online presence tracking for: ${conversationId}`)

    const channel = realtimeManager.getOrCreateChannel(conversationId)

    // Handler for presence sync
    const handlePresenceSync = () => {
      const state = channel.presenceState()
      const online = new Set<string>()

      // Extract all online user IDs from presence state
      Object.values(state).forEach((presences: any) => {
        presences.forEach((presence: any) => {
          // Exclude current user and only track users with recent online_at
          if (presence.user_id && presence.user_id !== currentUserId) {
            const onlineAt = presence.online_at ? new Date(presence.online_at).getTime() : 0
            const now = Date.now()
            const fiveMinutesAgo = now - 5 * 60 * 1000

            // Only consider online if presence was updated in last 5 minutes
            if (onlineAt > fiveMinutesAgo) {
              online.add(presence.user_id)
            }
          }
        })
      })

      console.log(`👥 Online users updated for ${conversationId}:`, online.size)
      setOnlineUsers(online)
    }

    // Subscribe to presence events
    channel.on('presence', { event: 'sync' }, handlePresenceSync)
    channel.on('presence', { event: 'join' }, handlePresenceSync)
    channel.on('presence', { event: 'leave' }, handlePresenceSync)

    // Track own presence
    trackPresence()

    // Initial sync
    handlePresenceSync()

    return () => {
      console.log(`🔌 Cleaning up online presence for: ${conversationId}`)

      // Clear online users
      setOnlineUsers(new Set())

      // Untrack presence
      untrackPresence()

      // Note: Don't release channel here - useConversationRealtime handles that
    }
  }, [conversationId, currentUserId, enabled, trackPresence, untrackPresence])

  // Helper function to check if a specific user is online
  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return onlineUsers.has(userId)
    },
    [onlineUsers]
  )

  // Get array of online user IDs
  const onlineUserIds = Array.from(onlineUsers)

  return {
    onlineUsers, // Set<string> of user IDs
    onlineUserIds, // Array<string> of user IDs
    isUserOnline, // (userId: string) => boolean
    onlineCount: onlineUsers.size, // number of online users
  }
}
