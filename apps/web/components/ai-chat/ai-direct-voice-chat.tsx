'use client'

import { useEffect, useRef } from 'react'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
import { toast } from 'sonner'
import { getAgentTools, type AgentContext } from '@/lib/ai/agent-tools'

interface AIDirectVoiceChatProps {
  clientSecret: string
  model: string
  userId: string
  userName: string
  onStateChange?: (state: 'listening' | 'speaking') => void
  onDisconnect?: () => void
}

/**
 * AIDirectVoiceChat - Direct 1-on-1 voice chat with AI
 *
 * Uses OpenAI Agents SDK with WebRTC transport (default) which automatically:
 * - Captures microphone audio
 * - Plays AI responses through speakers
 *
 * Based on: https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
 */
export function AIDirectVoiceChat({
  clientSecret,
  model,
  userId,
  userName,
  onStateChange,
  onDisconnect,
}: AIDirectVoiceChatProps) {
  // Use refs for callbacks to avoid stale closures in event listeners
  // and to prevent the effect from re-running when callbacks change
  const onStateChangeRef = useRef(onStateChange)
  // eslint-disable-next-line react-hooks/refs
  onStateChangeRef.current = onStateChange

  const onDisconnectRef = useRef(onDisconnect)
  // eslint-disable-next-line react-hooks/refs
  onDisconnectRef.current = onDisconnect

  useEffect(() => {
    if (!clientSecret || !userId) return

    let cancelled = false
    let session: RealtimeSession | null = null
    console.log('[AIChat:WebRTC] Starting connection...')

    // Create context and tools for this user
    const agentContext: AgentContext = { userId, userName }
    const tools = getAgentTools(agentContext)

    async function connectSession() {
      try {
        const agent = new RealtimeAgent({
          name: 'Assistant',
          instructions: `You are a helpful AI assistant having a voice conversation with ${userName}.
Keep responses concise (1-3 sentences) for natural voice flow.
Be helpful, friendly, and engaging.

CAPABILITIES:
You can send messages on behalf of ${userName}. When asked to send a message:
1. First call get_users to see all available users and their IDs
2. Match the name the user mentioned to find the correct recipient
3. Call send_message with the recipient's ID and the message content
4. Confirm to ${userName} that the message was sent

Example: If ${userName} says "Send hello to John", you should:
1. Call get_users to find John's ID
2. Call send_message with John's ID and "hello"
3. Say "Done, I've sent hello to John"

Always use get_users first before send_message to get the correct user ID.`,
          tools,
        })

        session = new RealtimeSession(agent)

        // Track speaking state via refs (never stale)
        session.on('audio_start', () => {
          console.log('[AIChat:WebRTC] AI speaking')
          onStateChangeRef.current?.('speaking')
        })
        session.on('audio_stopped', () => {
          console.log('[AIChat:WebRTC] AI stopped speaking')
          onStateChangeRef.current?.('listening')
        })
        session.on('audio_interrupted', () => {
          console.log('[AIChat:WebRTC] AI interrupted')
          onStateChangeRef.current?.('listening')
        })
        session.on('error', (error) => {
          console.error('[AIChat:WebRTC] Session error:', error)
          toast.error('AI connection error')
        })

        // Connect - WebRTC auto configures mic and speaker
        console.log('[AIChat:WebRTC] Calling session.connect()...')
        await session.connect({
          apiKey: clientSecret,
          model,
        })

        // If React Strict Mode unmounted us while awaiting, tear down immediately
        if (cancelled) {
          console.log('[AIChat:WebRTC] Cancelled (Strict Mode cleanup) — closing session')
          session.close()
          return
        }

        console.log('[AIChat:WebRTC] ✅ Connected successfully')
        toast.success('Connected to AI')
        onStateChangeRef.current?.('listening')
      } catch (error) {
        if (cancelled) return
        console.error('[AIChat:WebRTC] ❌ Connection failed:', error)
        toast.error('Failed to connect to AI')
        onDisconnectRef.current?.()
      }
    }

    connectSession()

    // Cleanup: runs on unmount (including React Strict Mode's first unmount)
    return () => {
      console.log('[AIChat:WebRTC] Cleanup — closing session')
      cancelled = true
      if (session) {
        session.close()
        session = null
      }
    }
  }, [clientSecret, model, userId, userName]) // Only reconnect when these actually change

  return null
}
