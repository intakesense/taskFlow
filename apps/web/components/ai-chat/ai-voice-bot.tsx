'use client'

import { useEffect, useRef } from 'react'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import { toast } from 'sonner'
import { getAgentTools, type AgentContext } from '@/lib/ai/agent-tools'
import type { RealtimeItem } from '@openai/agents/realtime'

interface AIVoiceBotProps {
  clientSecret: string
  model: string
  voice: string
  botName: string
  triggerPhrases: string[]
  userId: string
  userName: string
  channelId: string
  /** Called when the session connects successfully */
  onConnected?: () => void
  /** Called when the session disconnects or errors */
  onDisconnect?: () => void
  /**
   * Called once after the session is ready with a mute function.
   * Parent can store this ref and call it to mute/unmute the bot mic.
   */
  onMuteReady?: (mute: (muted: boolean) => void) => void
}

/**
 * AIVoiceBot — renderless component that manages the OpenAI Realtime session
 * for the voice channel bot (the "host" side).
 *
 * Responsibilities:
 * - Creates RealtimeAgent with voice + dynamic trigger_phrases instructions
 * - Creates RealtimeSession with model on the constructor (not connect())
 * - Exposes session.mute() to the parent via onMuteReady callback
 * - Captures history_updated events to build a transcript
 * - On unmount: closes session and sends transcript to the leave route
 */
export function AIVoiceBot({
  clientSecret,
  model,
  voice,
  botName,
  triggerPhrases,
  userId,
  userName,
  channelId,
  onConnected,
  onDisconnect,
  onMuteReady,
}: AIVoiceBotProps) {
  // Use refs for callbacks to avoid stale closures in event listeners
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected

  const onDisconnectRef = useRef(onDisconnect)
  onDisconnectRef.current = onDisconnect

  const onMuteReadyRef = useRef(onMuteReady)
  onMuteReadyRef.current = onMuteReady

  useEffect(() => {
    if (!clientSecret || !userId || !channelId) return

    let cancelled = false
    let session: RealtimeSession | null = null
    // Live transcript — updated on every history_updated event.
    // Stored in a ref so the cleanup function always sees the latest snapshot
    // without the effect needing to re-run.
    const transcriptRef: { current: RealtimeItem[] } = { current: [] }

    // Build trigger phrase instructions from admin config.
    // The Realtime API has no native wake-word detection — this must be prompt-driven.
    const phrasesFormatted = triggerPhrases
      .map((p, i) => (i === 0 ? p : i === triggerPhrases.length - 1 ? `or ${p}` : p))
      .join(', ')

    const agentContext: AgentContext = { userId, userName }
    const tools = getAgentTools(agentContext)

    async function connectSession() {
      try {
        const agent = new RealtimeAgent({
          name: botName,
          // voice must be set on RealtimeAgent, not on RealtimeSession or connect()
          voice,
          instructions: `You are ${botName}, an AI assistant in a voice channel with multiple participants.

ACTIVATION: Only respond when someone addresses you by name. Listen for: ${phrasesFormatted}.
If you are not being addressed, stay silent. Do not respond to general conversation.

STYLE: Keep responses concise (1-3 sentences) for natural voice flow.

CAPABILITIES:
You can send direct messages on behalf of the user who activated you (${userName}).
When asked to send a message:
1. Call get_users to see all available users and their IDs
2. Match the name mentioned to find the correct recipient
3. Call send_message with the recipient's ID and the message content
4. Confirm that the message was sent

Always call get_users first before send_message to get the correct user ID.`,
          tools,
        })

        // model goes on the RealtimeSession constructor — the SDK source confirms
        // that connect()'s model field is ignored by the transport layer
        session = new RealtimeSession(agent, {
          model,
          context: agentContext,
        })

        // Capture transcript on every history update
        session.on('history_updated', (history: RealtimeItem[]) => {
          transcriptRef.current = history
        })

        session.on('audio_start', () => {
          console.log('[AIVoiceBot] Speaking')
        })
        session.on('audio_stopped', () => {
          console.log('[AIVoiceBot] Stopped speaking')
        })
        session.on('audio_interrupted', () => {
          console.log('[AIVoiceBot] Interrupted')
        })
        session.on('error', (error) => {
          console.error('[AIVoiceBot] Session error:', error)
          toast.error(`${botName} encountered an error`)
        })

        console.log('[AIVoiceBot] Connecting...')
        // connect() receives only apiKey — model is already on the constructor
        await session.connect({ apiKey: clientSecret })

        if (cancelled) {
          session.close()
          return
        }

        console.log('[AIVoiceBot] Connected')
        toast.success(`${botName} joined the channel`)
        onConnectedRef.current?.()

        // Expose mute control to parent after connection is confirmed
        const muteSession = session
        onMuteReadyRef.current?.((muted: boolean) => {
          muteSession.mute(muted)
        })
      } catch (error) {
        if (cancelled) return
        console.error('[AIVoiceBot] Connection failed:', error)
        toast.error(`${botName} failed to connect`)
        onDisconnectRef.current?.()
      }
    }

    connectSession()

    return () => {
      cancelled = true

      if (session) {
        session.close()
        session = null
      }

      // Send transcript to leave route. Use sendBeacon for reliability on unmount.
      // sendBeacon is fire-and-forget — it survives page unload.
      const payload = JSON.stringify({
        channelId,
        transcript: transcriptRef.current.length > 0 ? transcriptRef.current : undefined,
      })

      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/ai/bot/leave', blob)
      } else {
        // Fallback: regular fetch (may not complete on page unload)
        fetch('/api/ai/bot/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Ignore errors on cleanup fetch
        })
      }
    }
  }, [clientSecret, model, voice, botName, triggerPhrases, userId, userName, channelId])

  return null
}
