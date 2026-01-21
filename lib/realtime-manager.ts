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
  private readonly MAX_CHANNELS = 5 // Safety limit to prevent browser resource exhaustion
  private emergencyCleanupRegistered = false

  /**
   * Get or create a channel for a conversation.
   * Multiple components can subscribe to the same channel without creating duplicates.
   * SAFETY: Enforces max channel limit to prevent browser death.
   */
  getOrCreateChannel(conversationId: string): RealtimeChannel {
    const channelKey = `conversation:${conversationId}`

    if (!this.channels.has(channelKey)) {
      // CRITICAL SAFETY CHECK: Prevent browser resource exhaustion
      if (this.channels.size >= this.MAX_CHANNELS) {
        console.error(`🚨 CRITICAL: Channel limit reached (${this.MAX_CHANNELS}). Cleaning up oldest channels.`)
        this.emergencyCleanupOldestChannel()
      }

      console.log('📡 Creating new channel:', channelKey)
      const channel = supabase.channel(channelKey)
      this.channels.set(channelKey, channel)
      this.refCounts.set(channelKey, 0)

      // Register emergency cleanup on first channel creation
      if (!this.emergencyCleanupRegistered) {
        this.registerEmergencyCleanup()
        this.emergencyCleanupRegistered = true
      }
    }

    const refCount = this.refCounts.get(channelKey) || 0
    this.refCounts.set(channelKey, refCount + 1)
    console.log(`📊 Channel ${channelKey} ref count: ${refCount + 1}`)

    return this.channels.get(channelKey)!
  }

  /**
   * Emergency cleanup of oldest channel when limit is reached
   */
  private emergencyCleanupOldestChannel(): void {
    // Find channel with lowest ref count (likely stale)
    let oldestChannel: string | undefined = undefined
    let lowestRefCount = Infinity

    this.refCounts.forEach((count, key) => {
      if (count < lowestRefCount) {
        lowestRefCount = count
        oldestChannel = key
      }
    })

    if (oldestChannel) {
      console.warn(`🧹 Emergency cleanup: Removing channel ${oldestChannel}`)

      const channel = this.channels.get(oldestChannel)
      if (channel) {
        supabase.removeChannel(channel)
      }

      this.channels.delete(oldestChannel)
      this.refCounts.delete(oldestChannel)
      this.configured.delete(oldestChannel)
    }
  }

  /**
   * Register emergency cleanup on page unload to prevent zombie connections
   */
  private registerEmergencyCleanup(): void {
    if (typeof window === 'undefined') return

    const cleanupHandler = () => {
      console.log('🚨 EMERGENCY: Cleaning up all channels before page unload')
      this.cleanup()
    }

    // Multiple event handlers to catch all scenarios
    window.addEventListener('beforeunload', cleanupHandler)
    window.addEventListener('pagehide', cleanupHandler)

    // Also cleanup on visibility change to hidden (mobile/tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.channels.size > 0) {
        console.log('👁️ Page hidden, maintaining channels but clearing old presence')
        // Don't cleanup channels, but clear presence tracking
        this.channels.forEach((channel) => {
          channel.untrack().catch(() => {})
        })
      }
    })

    console.log('✅ Emergency cleanup handlers registered')
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
   * CRITICAL: This prevents zombie connections that kill the browser
   */
  cleanup(): void {
    console.log(`🧹 Cleaning up ${this.channels.size} channels`)

    this.channels.forEach((channel, key) => {
      console.log(`🔌 Force removing channel: ${key}`)

      // Untrack presence first (fire and forget)
      channel.untrack().catch((err) => {
        console.warn(`Failed to untrack ${key}:`, err)
      })

      // Remove channel
      supabase.removeChannel(channel)
    })

    // Clear all maps
    this.channels.clear()
    this.refCounts.clear()
    this.configured.clear()

    console.log('✅ All channels cleaned up')
  }

  /**
   * Force cleanup a specific channel (emergency use)
   */
  forceRemoveChannel(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`
    const channel = this.channels.get(channelKey)

    if (channel) {
      console.warn(`🚨 Force removing channel: ${channelKey}`)
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
      this.channels.delete(channelKey)
      this.refCounts.delete(channelKey)
      this.configured.delete(channelKey)
    }
  }

  /**
   * Get debug info about active channels
   */
  getDebugInfo(): { channelKey: string; refCount: number; configured: boolean }[] {
    return Array.from(this.channels.keys()).map((key) => ({
      channelKey: key,
      refCount: this.refCounts.get(key) || 0,
      configured: this.configured.has(key),
    }))
  }

  /**
   * Health check for debugging stuck states
   */
  getHealthStatus(): {
    totalChannels: number
    configuredChannels: number
    maxChannels: number
    isHealthy: boolean
    warnings: string[]
  } {
    const warnings: string[] = []

    if (this.channels.size >= this.MAX_CHANNELS) {
      warnings.push(`Channel limit reached (${this.channels.size}/${this.MAX_CHANNELS})`)
    }

    // Check for channels with ref count 0 (potential leak)
    const zeroRefChannels: string[] = []
    this.refCounts.forEach((count, key) => {
      if (count === 0) {
        zeroRefChannels.push(key)
      }
    })

    if (zeroRefChannels.length > 0) {
      warnings.push(`Found ${zeroRefChannels.length} channels with 0 ref count (potential leak)`)
    }

    // Check for unconfigured channels (should not happen)
    const unconfiguredChannels = this.channels.size - this.configured.size
    if (unconfiguredChannels > 0) {
      warnings.push(`Found ${unconfiguredChannels} channels without configuration`)
    }

    return {
      totalChannels: this.channels.size,
      configuredChannels: this.configured.size,
      maxChannels: this.MAX_CHANNELS,
      isHealthy: warnings.length === 0 && this.channels.size < this.MAX_CHANNELS,
      warnings,
    }
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager()

// Expose to window for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as any).__realtimeManager = realtimeManager
}
