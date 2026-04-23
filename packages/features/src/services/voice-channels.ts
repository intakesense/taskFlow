import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  VoiceChannel,
  VoiceChannelMemberWithUser,
  VoiceChannelWithParticipants,
  VoiceParticipantWithUser,
} from '@taskflow/core';

export interface VoiceChannelsService {
  getChannels(): Promise<VoiceChannelWithParticipants[]>;
  getDefaultChannel(): Promise<VoiceChannel | null>;
  getParticipants(channelId: string): Promise<VoiceParticipantWithUser[]>;
  joinChannel(channelId: string, userId: string): Promise<void>;
  leaveChannel(userId: string): Promise<void>;
  createChannel(name: string, description: string | null, createdBy: string, isPrivate?: boolean): Promise<VoiceChannel>;
  deleteChannel(channelId: string): Promise<void>;
  updateChannel(channelId: string, updates: { name?: string; is_private?: boolean }): Promise<void>;
  getCurrentChannel(userId: string): Promise<string | null>;
  startSession(channelId: string, userId: string): Promise<string>;
  endSession(sessionId: string): Promise<void>;
  getMembers(channelId: string): Promise<VoiceChannelMemberWithUser[]>;
  addMember(channelId: string, userId: string): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;
}

export function createVoiceChannelsService(
  supabase: SupabaseClient
): VoiceChannelsService {
  return {
    /**
     * Get all voice channels with participants
     */
    async getChannels(): Promise<VoiceChannelWithParticipants[]> {
      const { data, error } = await supabase
        .from('voice_channels')
        .select(
          `
          *,
          participants:voice_channel_participants(
            *,
            user:users(id, name, email, avatar_url, level)
          )
        `
        )
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      return (data || []).map((channel) => ({
        ...channel,
        participantCount: channel.participants?.length || 0,
      })) as VoiceChannelWithParticipants[];
    },

    /**
     * Get the default voice channel
     */
    async getDefaultChannel(): Promise<VoiceChannel | null> {
      const { data, error } = await supabase
        .from('voice_channels')
        .select('*')
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    /**
     * Get participants for a channel with user details
     */
    async getParticipants(channelId: string): Promise<VoiceParticipantWithUser[]> {
      const { data, error } = await supabase
        .from('voice_channel_participants')
        .select(
          `
          *,
          user:users(id, name, email, avatar_url, level)
        `
        )
        .eq('channel_id', channelId)
        .order('joined_at');

      if (error) throw error;
      return (data || []) as VoiceParticipantWithUser[];
    },

    /**
     * Join a voice channel (database record)
     * First leaves any existing channel
     */
    async joinChannel(channelId: string, userId: string): Promise<void> {
      // First leave any existing channel
      await supabase
        .from('voice_channel_participants')
        .delete()
        .eq('user_id', userId);

      // Then join the new channel
      const { error } = await supabase.from('voice_channel_participants').insert({
        channel_id: channelId,
        user_id: userId,
      });

      if (error) throw error;
    },

    /**
     * Leave current voice channel (database record)
     */
    async leaveChannel(userId: string): Promise<void> {
      const { error } = await supabase
        .from('voice_channel_participants')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },

    /**
     * Create a new voice channel (admin only, enforced by RLS)
     */
    async createChannel(name: string, description: string | null, createdBy: string, isPrivate = false): Promise<VoiceChannel> {
      const { data, error } = await supabase
        .from('voice_channels')
        .insert({ name: name.trim(), description, created_by: createdBy, is_private: isPrivate })
        .select()
        .single();

      if (error) throw error;
      return data as VoiceChannel;
    },

    /**
     * Delete a voice channel (admin only, enforced by RLS)
     */
    async deleteChannel(channelId: string): Promise<void> {
      const { error } = await supabase
        .from('voice_channels')
        .delete()
        .eq('id', channelId);

      if (error) throw error;
    },

    /**
     * Update channel metadata (admin only, enforced by RLS)
     */
    async updateChannel(channelId: string, updates: { name?: string; is_private?: boolean }): Promise<void> {
      const { error } = await supabase
        .from('voice_channels')
        .update(updates)
        .eq('id', channelId);

      if (error) throw error;
    },

    /**
     * Get user's current channel ID
     */
    async getCurrentChannel(userId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('voice_channel_participants')
        .select('channel_id')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.channel_id || null;
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
        .single();

      if (error) throw error;
      return data.id;
    },

    /**
     * Log session end
     */
    async endSession(sessionId: string): Promise<void> {
      const { error } = await supabase
        .from('voice_channel_sessions')
        .update({ left_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    },

    /**
     * Get allowlist members for a private channel
     */
    async getMembers(channelId: string): Promise<VoiceChannelMemberWithUser[]> {
      const { data, error } = await supabase
        .from('voice_channel_members')
        .select('*, user:users(id, name, email, avatar_url, level)')
        .eq('channel_id', channelId);

      if (error) throw error;
      return (data || []) as VoiceChannelMemberWithUser[];
    },

    /**
     * Add a user to a private channel's allowlist (admin only, enforced by RLS)
     */
    async addMember(channelId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('voice_channel_members')
        .insert({ channel_id: channelId, user_id: userId });

      if (error && error.code !== '23505') throw error; // ignore duplicate
    },

    /**
     * Remove a user from a private channel's allowlist (admin only, enforced by RLS)
     */
    async removeMember(channelId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('voice_channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;
    },
  };
}
