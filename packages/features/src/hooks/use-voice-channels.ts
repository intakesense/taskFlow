'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/error';
import type { VoiceChannelMemberWithUser, VoiceChannelWithParticipants } from '@taskflow/core';
import { useSupabase } from '../providers/services-context';
import { createVoiceChannelsService } from '../services/voice-channels';

export const voiceChannelKeys = {
  all: ['voice-channels'] as const,
  list: () => [...voiceChannelKeys.all, 'list'] as const,
  detail: (id: string) => [...voiceChannelKeys.all, 'detail', id] as const,
  members: (channelId: string) => [...voiceChannelKeys.all, 'members', channelId] as const,
};

/**
 * Hook to fetch all voice channels with participants
 */
export function useVoiceChannels() {
  const supabase = useSupabase();
  const service = createVoiceChannelsService(supabase);

  return useQuery<VoiceChannelWithParticipants[]>({
    queryKey: voiceChannelKeys.list(),
    queryFn: () => service.getChannels(),
  });
}

/**
 * Hook to subscribe to realtime updates for voice channel participants
 */
export function useVoiceChannelsRealtime() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateList = () => queryClient.refetchQueries({ queryKey: voiceChannelKeys.list() });

    const channel = supabase
      .channel('voice-channels-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_channel_participants' }, invalidateList)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_channel_members' }, invalidateList)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);
}

/**
 * Hook to create a voice channel (admin only)
 */
export function useCreateVoiceChannel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, description, createdBy, isPrivate }: { name: string; description: string | null; createdBy: string; isPrivate?: boolean }) =>
      createVoiceChannelsService(supabase).createChannel(name, description, createdBy, isPrivate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceChannelKeys.list() });
      toast.success('Channel created');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to create channel'));
    },
  });
}

/**
 * Hook to update a voice channel (admin only)
 */
export function useUpdateVoiceChannel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, updates }: { channelId: string; updates: { name?: string; is_private?: boolean } }) =>
      createVoiceChannelsService(supabase).updateChannel(channelId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceChannelKeys.list() });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to update channel'));
    },
  });
}

/**
 * Hook to delete a voice channel (admin only)
 */
export function useDeleteVoiceChannel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      createVoiceChannelsService(supabase).deleteChannel(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voiceChannelKeys.list() });
      toast.success('Channel deleted');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete channel'));
    },
  });
}

/**
 * Hook to get the default voice channel
 */
export function useDefaultVoiceChannel() {
  const supabase = useSupabase();
  const service = createVoiceChannelsService(supabase);

  return useQuery({
    queryKey: [...voiceChannelKeys.all, 'default'],
    queryFn: () => service.getDefaultChannel(),
  });
}

/**
 * Hook to fetch allowlist members for a private channel
 */
export function useVoiceChannelMembers(channelId: string | null) {
  const supabase = useSupabase();

  return useQuery<VoiceChannelMemberWithUser[]>({
    queryKey: voiceChannelKeys.members(channelId ?? ''),
    queryFn: () => createVoiceChannelsService(supabase).getMembers(channelId!),
    enabled: !!channelId,
  });
}

/**
 * Hook to add a user to a channel's allowlist (admin only)
 */
export function useAddVoiceChannelMember() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) =>
      createVoiceChannelsService(supabase).addMember(channelId, userId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: voiceChannelKeys.members(channelId) });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to add member'));
    },
  });
}

/**
 * Hook to remove a user from a channel's allowlist (admin only)
 */
export function useRemoveVoiceChannelMember() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) =>
      createVoiceChannelsService(supabase).removeMember(channelId, userId),
    onSuccess: (_, { channelId }) => {
      queryClient.invalidateQueries({ queryKey: voiceChannelKeys.members(channelId) });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to remove member'));
    },
  });
}
