'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { VoiceChannelWithParticipants } from '@taskflow/core';
import { useSupabase } from '../providers/services-context';
import { createVoiceChannelsService } from '../services/voice-channels';

export const voiceChannelKeys = {
  all: ['voice-channels'] as const,
  list: () => [...voiceChannelKeys.all, 'list'] as const,
  detail: (id: string) => [...voiceChannelKeys.all, 'detail', id] as const,
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
    const channel = supabase
      .channel('voice-channels-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_channel_participants',
        },
        () => {
          queryClient.refetchQueries({
            queryKey: voiceChannelKeys.list(),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);
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
