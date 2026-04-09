'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { voiceChannelService } from '@/lib/services/voice-channels'

const supabase = createClient()

export const voiceParticipantKeys = {
  all: ['voice-participants'] as const,
  channel: (channelId: string) => [...voiceParticipantKeys.all, channelId] as const,
}

export function useVoiceParticipants(channelId: string | null) {
  const queryClient = useQueryClient()

  const {
    data: participants = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: voiceParticipantKeys.channel(channelId || ''),
    queryFn: () => voiceChannelService.getParticipants(channelId!),
    enabled: !!channelId,
    staleTime: 10000,
  })

  useEffect(() => {
    if (!channelId) return

    const channel = supabase
      .channel(`voice-participants:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_channel_participants',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: voiceParticipantKeys.channel(channelId),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, queryClient])

  return {
    participants,
    participantCount: participants.length,
    isLoading,
    error,
  }
}

export function useVoiceParticipantCount(channelId: string | null) {
  const queryClient = useQueryClient()

  const { data: count = 0 } = useQuery({
    queryKey: [...voiceParticipantKeys.channel(channelId || ''), 'count'],
    queryFn: () => voiceChannelService.getParticipantCount(channelId!),
    enabled: !!channelId,
    staleTime: 5000,
  })

  useEffect(() => {
    if (!channelId) return

    const channel = supabase
      .channel(`voice-count:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_channel_participants',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [...voiceParticipantKeys.channel(channelId), 'count'],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, queryClient])

  return count
}
