'use client'

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

export type AIChatState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

interface StartChatResponse {
  clientSecret: string
  model: string
}

/**
 * Hook for managing direct AI voice chat state.
 * Separate from the voice channel bot - this is for 1-on-1 AI conversations.
 */
export function useAIDirectChat() {
  const [state, setState] = useState<AIChatState>('idle')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [model, setModel] = useState<string>('')

  // Get token mutation
  const { mutate: requestToken } = useMutation({
    mutationFn: async (): Promise<StartChatResponse> => {
      const response = await fetch('/api/ai/chat/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start AI chat')
      }

      return response.json()
    },
    onSuccess: (data) => {
      console.log('[AIChat:Hook] ✅ Token received, model:', data.model)
      setClientSecret(data.clientSecret)
      setModel(data.model)
      setState('listening')
    },
    onError: (error: Error) => {
      console.error('[AIChat:Hook] ❌ Token error:', error.message)
      setState('error')
      toast.error(error.message)
    },
  })

  const startChat = useCallback(() => {
    console.log('[AIChat:Hook] Starting chat — requesting token...')
    setState('connecting')
    requestToken()
  }, [requestToken])

  const endChat = useCallback(() => {
    console.log('[AIChat:Hook] Chat ended')
    setClientSecret(null)
    setState('idle')
  }, [])

  const setListening = useCallback(() => {
    setState('listening')
  }, [])

  const setSpeaking = useCallback(() => {
    setState('speaking')
  }, [])

  const setError = useCallback(() => {
    setState('error')
  }, [])

  return {
    // State
    state,
    isActive: state !== 'idle',
    isConnecting: state === 'connecting',
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    isError: state === 'error',
    clientSecret,
    model,

    // Actions
    startChat,
    endChat,
    setListening,
    setSpeaking,
    setError,
  }
}
