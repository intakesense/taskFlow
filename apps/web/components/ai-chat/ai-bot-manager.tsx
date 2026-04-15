'use client'

import { useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useVoiceChannel } from '@taskflow/features'
import { useAuth } from '@/lib/auth-context'
import { useAIBotSession } from '@/hooks/use-ai-bot-session'

// Dynamic import avoids SSR issues with @openai/agents
const AIVoiceBot = dynamic(
  () => import('./ai-voice-bot').then(mod => mod.AIVoiceBot),
  { ssr: false }
)

/**
 * AIBotManager — web-only component that bridges the voice channel context
 * and the AI bot session. Renders AIVoiceBot (a renderless OpenAI Realtime
 * session) when the current user is the host and has an active client secret.
 *
 * Must be rendered inside VoiceChannelProvider (already set up in web-features-provider).
 */
export function AIBotManager() {
  const { currentChannel } = useVoiceChannel()
  const { effectiveUser } = useAuth()

  const channelId = currentChannel?.id ?? null

  const {
    clientSecret,
    botName,
    model,
    voice,
    triggerPhrases,
    isCurrentUserHost,
    deactivate,
  } = useAIBotSession(channelId)

  // Store the mute function provided by AIVoiceBot after connection
  const muteRef = useRef<((muted: boolean) => void) | null>(null)

  const handleMuteReady = useCallback((mute: (muted: boolean) => void) => {
    muteRef.current = mute
  }, [])

  const handleDisconnect = useCallback(() => {
    // If the session drops unexpectedly, deactivate on the server too
    deactivate()
  }, [deactivate])

  // Only render the bot session component when:
  // 1. This user is the host (they hold the client secret)
  // 2. A client secret exists (activation succeeded)
  // 3. We have a channel and user
  if (!clientSecret || !isCurrentUserHost || !channelId || !effectiveUser) {
    return null
  }

  return (
    <AIVoiceBot
      clientSecret={clientSecret}
      model={model}
      voice={voice}
      botName={botName}
      triggerPhrases={triggerPhrases}
      userId={effectiveUser.id}
      userName={effectiveUser.name ?? 'User'}
      channelId={channelId}
      onMuteReady={handleMuteReady}
      onDisconnect={handleDisconnect}
    />
  )
}
