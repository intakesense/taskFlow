/**
 * Centralized Realtime Manager
 * Prevents channel leaks by maintaining a single channel per conversation
 * and properly cleaning up subscriptions.
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

class RealtimeManager {
  private channels = new Map<string, RealtimeChannel>()
  private refCounts = new Map<string, number>()
  private configured = new Set<string>() // Track which channels have listeners configured

  /**
   * Get or create a channel for a conversation.
   * Multiple components can subscribe to the same channel without creating duplicates.
   */
  getOrCreateChannel(conversationId: string): RealtimeChannel {
    const channelKey = `conversation:${conversationId}`

    if (!this.channels.has(channelKey)) {
      console.log('📡 Creating new channel:', channelKey)
      const channel = supabase.channel(channelKey)
      this.channels.set(channelKey, channel)
      this.refCounts.set(channelKey, 0)
    }

    const refCount = this.refCounts.get(channelKey) || 0
    this.refCounts.set(channelKey, refCount + 1)
    console.log(`📊 Channel ${channelKey} ref count: ${refCount + 1}`)

    return this.channels.get(channelKey)!
  }

  /**
   * Check if a channel has been configured with listeners
   */
  isChannelConfigured(conversationId: string): boolean {
    const channelKey = `conversation:${conversationId}`
    return this.configured.has(channelKey)
  }

  /**
   * Mark a channel as configured
   */
  markAsConfigured(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`
    this.configured.add(channelKey)
  }

  /**
   * Release a channel reference. When ref count reaches 0, clean up the channel.
   */
  releaseChannel(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`
    const refCount = this.refCounts.get(channelKey) || 0

    if (refCount <= 1) {
      console.log('🔌 Removing channel:', channelKey)
      const channel = this.channels.get(channelKey)
      if (channel) {
        supabase.removeChannel(channel)
        this.channels.delete(channelKey)
        this.refCounts.delete(channelKey)
        this.configured.delete(channelKey)
      }
    } else {
      this.refCounts.set(channelKey, refCount - 1)
      console.log(`📊 Channel ${channelKey} ref count: ${refCount - 1}`)
    }
  }

  /**
   * Get the global typing channel (shared across all conversations)
   */
  getGlobalChannel(): RealtimeChannel {
    const channelKey = 'global-conversations'

    if (!this.channels.has(channelKey)) {
      console.log('📡 Creating global channel:', channelKey)
      const channel = supabase.channel(channelKey)
      this.channels.set(channelKey, channel)
      this.refCounts.set(channelKey, 0)
    }

    const refCount = this.refCounts.get(channelKey) || 0
    this.refCounts.set(channelKey, refCount + 1)

    return this.channels.get(channelKey)!
  }

  /**
   * Release the global channel reference
   */
  releaseGlobalChannel(): void {
    const channelKey = 'global-conversations'
    const refCount = this.refCounts.get(channelKey) || 0

    if (refCount <= 1) {
      console.log('🔌 Removing global channel')
      const channel = this.channels.get(channelKey)
      if (channel) {
        supabase.removeChannel(channel)
        this.channels.delete(channelKey)
        this.refCounts.delete(channelKey)
      }
    } else {
      this.refCounts.set(channelKey, refCount - 1)
    }
  }

  /**
   * Clean up all channels (useful for debugging)
   */
  cleanup(): void {
    console.log('🧹 Cleaning up all channels')
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()
    this.refCounts.clear()
  }

  /**
   * Get debug info about active channels
   */
  getDebugInfo(): { channelKey: string; refCount: number }[] {
    return Array.from(this.channels.keys()).map((key) => ({
      channelKey: key,
      refCount: this.refCounts.get(key) || 0,
    }))
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager()

// Expose to window for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).__realtimeManager = realtimeManager
}
