'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
const supabase = createClient()

export const aiBotSessionKeys = {
  all: ['ai-bot-session'] as const,
  status: (channelId: string) => [...aiBotSessionKeys.all, 'status', channelId] as const,
}

interface BotSessionStatus {
  isActive: boolean
  sessionId?: string
  hostUserId?: string
  hostName?: string
  isCurrentUserHost?: boolean
  startedAt?: string
}

interface ActivateBotResponse {
  success: boolean
  message: string
  sessionId: string
  botName: string
  clientSecret: { value: string } | string
  expiresAt: number
  model: string
}

/**
 * Hook to manage AI bot session in a voice channel.
 * Handles activation, deactivation, and real-time status updates.
 */
export function useAIBotSession(channelId: string | null) {
  const { effectiveUser } = useAuth()
  const queryClient = useQueryClient()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [botName, setBotName] = useState<string>('Bot')
  const [model, setModel] = useState<string>('gpt-4o-realtime-preview')

  // Query current bot status
  const {
    data: status,
    isLoading: isLoadingStatus,
  } = useQuery<BotSessionStatus>({
    queryKey: aiBotSessionKeys.status(channelId || ''),
    queryFn: async () => {
      const response = await fetch(`/api/ai/bot/join?channelId=${channelId}`)
      if (!response.ok) {
        throw new Error('Failed to get bot status')
      }
      return response.json()
    },
    enabled: !!channelId,
    staleTime: 5000,
    refetchInterval: 10000, // Refetch every 10s to keep status fresh
  })

  // Subscribe to real-time updates for ai_sessions
  // We use refetchInterval on the query instead of realtime subscriptions
  // to avoid issues with Supabase channel state in React Strict Mode

  // Activate bot mutation
  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/bot/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.alreadyActive) {
          throw new Error(`Bot is already active (hosted by ${data.hostName})`)
        }
        throw new Error(data.error || 'Failed to activate bot')
      }

      return data as ActivateBotResponse
    },
    onSuccess: (data) => {
      // Extract the token value
      const secret = typeof data.clientSecret === 'object'
        ? data.clientSecret.value
        : data.clientSecret
      setClientSecret(secret)
      setBotName(data.botName)
      setModel(data.model)
      toast.success(`${data.botName} activated`)
      queryClient.invalidateQueries({
        queryKey: aiBotSessionKeys.status(channelId || ''),
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Deactivate bot mutation
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ai/bot/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate bot')
      }

      return data
    },
    onSuccess: (data) => {
      setClientSecret(null)
      toast.success(data.message || 'Bot deactivated')
      queryClient.invalidateQueries({
        queryKey: aiBotSessionKeys.status(channelId || ''),
      })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const activate = useCallback(() => {
    if (!channelId || !effectiveUser) return
    activateMutation.mutate()
  }, [channelId, effectiveUser, activateMutation])

  const deactivate = useCallback(() => {
    if (!channelId) return
    deactivateMutation.mutate()
  }, [channelId, deactivateMutation])

  // Clear client secret when session ends (using ref to avoid effect loop)
  const prevIsActive = useRef(status?.isActive)
  useEffect(() => {
    // Only clear when transitioning from active to inactive
    if (prevIsActive.current && !status?.isActive && clientSecret) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClientSecret(null)
    }
    prevIsActive.current = status?.isActive
  }, [status?.isActive, clientSecret])

  return {
    // Status
    isActive: status?.isActive ?? false,
    isCurrentUserHost: status?.isCurrentUserHost ?? false,
    hostName: status?.hostName,
    sessionId: status?.sessionId,
    isLoadingStatus,

    // Actions
    activate,
    deactivate,
    isActivating: activateMutation.isPending,
    isDeactivating: deactivateMutation.isPending,

    // For the host to connect to OpenAI
    clientSecret,
    botName,
    model,
  }
}
