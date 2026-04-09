/**
 * Realtime Manager for Features Package
 * Prevents channel leaks by maintaining a single channel per conversation.
 * Unlike the web singleton, this is instantiated per-supabase-client.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';

export class RealtimeManager {
  private supabase: SupabaseClient<Database>;
  private channels = new Map<string, RealtimeChannel>();
  private refCounts = new Map<string, number>();
  private configured = new Set<string>();
  private readonly MAX_CHANNELS = 5;
  private emergencyCleanupRegistered = false;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Register emergency cleanup on page unload to prevent zombie connections
   */
  private registerEmergencyCleanup(): void {
    if (typeof window === 'undefined') return;

    const cleanupHandler = () => {
      this.cleanup();
    };

    // Clean up on actual page unload — NOT on tab hide/visibilitychange.
    // Clearing presence on hide causes CHANNEL_ERROR when the tab comes back;
    // the per-conversation hook handles reconnect on visibility restore instead.
    window.addEventListener('beforeunload', cleanupHandler);
    window.addEventListener('pagehide', cleanupHandler);
  }

  getOrCreateChannel(conversationId: string): RealtimeChannel {
    const channelKey = `conversation:${conversationId}`;

    if (!this.channels.has(channelKey)) {
      // CRITICAL SAFETY CHECK: Prevent browser resource exhaustion
      if (this.channels.size >= this.MAX_CHANNELS) {
        this.emergencyCleanupOldestChannel();
      }

      const channel = this.supabase.channel(channelKey);
      this.channels.set(channelKey, channel);
      this.refCounts.set(channelKey, 0);

      // Register emergency cleanup on first channel creation
      if (!this.emergencyCleanupRegistered) {
        this.registerEmergencyCleanup();
        this.emergencyCleanupRegistered = true;
      }
    }

    const refCount = this.refCounts.get(channelKey) || 0;
    this.refCounts.set(channelKey, refCount + 1);

    return this.channels.get(channelKey)!;
  }

  private emergencyCleanupOldestChannel(): void {
    let oldestChannel: string | undefined;
    let lowestRefCount = Infinity;

    this.refCounts.forEach((count, key) => {
      if (count < lowestRefCount) {
        lowestRefCount = count;
        oldestChannel = key;
      }
    });

    if (oldestChannel) {
      const channel = this.channels.get(oldestChannel);
      if (channel) {
        this.supabase.removeChannel(channel);
      }
      this.channels.delete(oldestChannel);
      this.refCounts.delete(oldestChannel);
      this.configured.delete(oldestChannel);
    }
  }

  reconnectChannel(conversationId: string): RealtimeChannel {
    this.forceRemoveChannel(conversationId);
    return this.getOrCreateChannel(conversationId);
  }

  isChannelConfigured(conversationId: string): boolean {
    const channelKey = `conversation:${conversationId}`;
    return this.configured.has(channelKey);
  }

  markAsConfigured(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`;
    this.configured.add(channelKey);
  }

  releaseChannel(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`;
    const refCount = this.refCounts.get(channelKey) || 0;

    if (refCount <= 1) {
      const channel = this.channels.get(channelKey);
      if (channel) {
        this.supabase.removeChannel(channel);
        this.channels.delete(channelKey);
        this.refCounts.delete(channelKey);
        this.configured.delete(channelKey);
      }
    } else {
      this.refCounts.set(channelKey, refCount - 1);
    }
  }

  forceRemoveChannel(conversationId: string): void {
    const channelKey = `conversation:${conversationId}`;
    const channel = this.channels.get(channelKey);

    if (channel) {
      channel.untrack().catch(() => {});
      this.supabase.removeChannel(channel);
      this.channels.delete(channelKey);
      this.refCounts.delete(channelKey);
      this.configured.delete(channelKey);
    }
  }

  cleanup(): void {
    this.channels.forEach((channel) => {
      // Untrack presence first (fire and forget)
      channel.untrack().catch(() => {});
      // Remove channel
      this.supabase.removeChannel(channel);
    });

    // Clear all maps
    this.channels.clear();
    this.refCounts.clear();
    this.configured.clear();
  }

  /**
   * Get the global typing channel (shared across all conversations)
   */
  getGlobalChannel(): RealtimeChannel {
    const channelKey = 'global-conversations';

    if (!this.channels.has(channelKey)) {
      const channel = this.supabase.channel(channelKey);
      this.channels.set(channelKey, channel);
      this.refCounts.set(channelKey, 0);
    }

    const refCount = this.refCounts.get(channelKey) || 0;
    this.refCounts.set(channelKey, refCount + 1);

    return this.channels.get(channelKey)!;
  }

  /**
   * Release the global channel reference
   */
  releaseGlobalChannel(): void {
    const channelKey = 'global-conversations';
    const refCount = this.refCounts.get(channelKey) || 0;

    if (refCount <= 1) {
      const channel = this.channels.get(channelKey);
      if (channel) {
        this.supabase.removeChannel(channel);
        this.channels.delete(channelKey);
        this.refCounts.delete(channelKey);
      }
    } else {
      this.refCounts.set(channelKey, refCount - 1);
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
    }));
  }

  /**
   * Health check for debugging stuck states
   */
  getHealthStatus(): {
    totalChannels: number;
    configuredChannels: number;
    maxChannels: number;
    isHealthy: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (this.channels.size >= this.MAX_CHANNELS) {
      warnings.push(`Channel limit reached (${this.channels.size}/${this.MAX_CHANNELS})`);
    }

    // Check for channels with ref count 0 (potential leak)
    const zeroRefChannels: string[] = [];
    this.refCounts.forEach((count, key) => {
      if (count === 0) {
        zeroRefChannels.push(key);
      }
    });

    if (zeroRefChannels.length > 0) {
      warnings.push(`Found ${zeroRefChannels.length} channels with 0 ref count (potential leak)`);
    }

    // Check for unconfigured channels (should not happen)
    const unconfiguredChannels = this.channels.size - this.configured.size;
    if (unconfiguredChannels > 0) {
      warnings.push(`Found ${unconfiguredChannels} channels without configuration`);
    }

    return {
      totalChannels: this.channels.size,
      configuredChannels: this.configured.size,
      maxChannels: this.MAX_CHANNELS,
      isHealthy: warnings.length === 0 && this.channels.size < this.MAX_CHANNELS,
      warnings,
    };
  }
}

// Factory function to create manager with injected supabase
export function createRealtimeManager(
  supabase: SupabaseClient<Database>
): RealtimeManager {
  return new RealtimeManager(supabase);
}
