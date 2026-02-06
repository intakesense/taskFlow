import { createClient } from '@/lib/supabase/client'
import type {
  VoiceChannel,
  VoiceChannelParticipant,
  VoiceParticipantWithUser,
} from '@/lib/types'

const supabase = createClient()

export const voiceChannelService = {
  /**
   * Get all voice channels
   */
  async getChannels(): Promise<VoiceChannel[]> {
    const { data, error } = await supabase
      .from('voice_channels')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get the default voice channel
   */
  async getDefaultChannel(): Promise<VoiceChannel | null> {
    const { data, error } = await supabase
      .from('voice_channels')
      .select('*')
      .eq('is_default', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get participants for a channel with user details
   */
  async getParticipants(channelId: string): Promise<VoiceParticipantWithUser[]> {
    const { data, error } = await supabase
      .from('voice_channel_participants')
      .select(`
        *,
        user:users(id, name, email, avatar_url, level)
      `)
      .eq('channel_id', channelId)
      .order('joined_at')

    if (error) throw error
    return (data || []) as VoiceParticipantWithUser[]
  },

  /**
   * Get or create Daily room for a channel
   */
  async getRoom(channelId: string): Promise<{ roomName: string; roomUrl: string }> {
    const response = await fetch('/api/daily/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    })

    if (!response.ok) {
      throw new Error('Failed to get room')
    }

    return response.json()
  },

  /**
   * Get Daily meeting token
   */
  async getToken(roomName: string): Promise<{ token: string; avatarUrl: string | null }> {
    const response = await fetch('/api/daily/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName }),
    })

    if (!response.ok) {
      throw new Error('Failed to get token')
    }

    const { token, avatarUrl } = await response.json()
    return { token, avatarUrl }
  },

  /**
   * Clean up stale participants (joined more than 15 minutes ago - matches room expiry)
   * This handles cases where browser was closed without proper cleanup
   */
  async cleanupStaleParticipants(channelId: string): Promise<void> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channelId)
      .lt('joined_at', fifteenMinutesAgo)
  },

  /**
   * Join a voice channel (database record)
   */
  async joinChannel(channelId: string, userId: string): Promise<void> {
    // First, remove any stale entry for this user (in case browser was closed)
    await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    // Then insert fresh entry
    const { error } = await supabase
      .from('voice_channel_participants')
      .insert({
        channel_id: channelId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_muted: false,
        is_video_on: false,
        is_screen_sharing: false,
        is_speaking: false,
      })

    if (error) throw error
  },

  /**
   * Leave a voice channel (database record)
   */
  async leaveChannel(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Update participant state (muted, video, etc.)
   */
  async updateParticipantState(
    channelId: string,
    userId: string,
    state: Partial<Pick<VoiceChannelParticipant,
      'is_muted' | 'is_video_on' | 'is_screen_sharing' | 'is_speaking' | 'connection_quality'
    >>
  ): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_participants')
      .update(state)
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Get participant count for a channel
   */
  async getParticipantCount(channelId: string): Promise<number> {
    const { count, error } = await supabase
      .from('voice_channel_participants')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)

    if (error) throw error
    return count || 0
  },

  /**
   * Log session start
   */
  async startSession(channelId: string, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('voice_channel_sessions')
      .insert({
        channel_id: channelId,
        user_id: userId,
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  },

  /**
   * Log session end
   */
  async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_sessions')
      .update({ left_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) throw error
  },
}
