'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'
// Note: dailyCall prop kept for future enhancement where we might
// route Daily.co participant audio to the AI
import { toast } from 'sonner'
import { getAgentTools, type AgentContext } from '@/lib/ai/agent-tools'

interface AIVoiceBotProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyCall: any // Kept for future Daily.co audio routing enhancement
  clientSecret: string
  botName: string
  model: string
  userId: string // Logged-in user's ID for tool context
  userName: string // Logged-in user's name for tool context
  onDisconnect?: () => void
}

/**
 * AIVoiceBot - Voice bot for Daily.co meetings using OpenAI Agents SDK
 *
 * The bot uses WebRTC transport which captures from the host's microphone.
 * The host's browser plays AI responses, which Daily.co then shares with participants.
 *
 * For proper meeting integration, the host should:
 * - Have their speakers playing into their mic (or use virtual audio routing)
 * - Or participants speak to the host who relays to the bot
 *
 * Based on: https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
 */
export function AIVoiceBot({
  dailyCall: _dailyCall, // Reserved for future Daily.co audio routing
  clientSecret,
  botName,
  model,
  userId,
  userName,
  onDisconnect,
}: AIVoiceBotProps) {
  const [isConnected, setIsConnected] = useState(false)
  const sessionRef = useRef<RealtimeSession | null>(null)

  // Connect to OpenAI Realtime API

  const connect = useCallback(async () => {
    if (sessionRef.current || !clientSecret) return

    // Create context for tools
    const agentContext: AgentContext = {
      userId,
      userName,
    }

    // Get tools configured with the user context
    const tools = getAgentTools(agentContext)

    try {
      const agent = new RealtimeAgent({
        name: botName,
        instructions: `You are ${botName}, a helpful AI assistant in a voice meeting for ${userName}.

BEHAVIOR:
- Listen to the conversation
- Only respond when someone directly addresses you by saying "${botName}" or "Hey ${botName}"
- Keep responses brief (1-2 sentences) for natural conversation
- Be helpful, friendly, and professional

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

IMPORTANT:
- When not directly addressed, stay COMPLETELY SILENT
- Don't interrupt the conversation
- Wait for your name to be called before responding
- Always use get_users first before send_message to get the correct user ID`,
        tools,
      })

      const session = new RealtimeSession(agent)
      sessionRef.current = session

      session.on('audio_start', () => {
        console.log('[AIVoiceBot] AI started speaking')
      })

      session.on('audio_stopped', () => {
        console.log('[AIVoiceBot] AI stopped speaking')
      })

      session.on('error', (error) => {
        console.error('[AIVoiceBot] Session error:', error)
        toast.error('AI connection error')
      })

      // Connect with ephemeral token
      await session.connect({
        apiKey: clientSecret,
        model,
      })

      setIsConnected(true)
      console.log('[AIVoiceBot] Connected to OpenAI Realtime API')
      toast.success(`${botName} is now listening`)

    } catch (error) {
      console.error('[AIVoiceBot] Connection error:', error)
      toast.error('Failed to connect AI assistant')
      sessionRef.current = null
    }
  }, [clientSecret, botName, model, userId, userName])

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close()
      sessionRef.current = null
    }
    setIsConnected(false)
    console.log('[AIVoiceBot] Disconnected')
    onDisconnect?.()
  }, [onDisconnect])

  useEffect(() => {
    if (clientSecret && !isConnected) {
      connect()
    }
    return () => disconnect()
  }, [clientSecret, isConnected, connect, disconnect])

  // No visible UI - WebRTC handles audio automatically
  return null
}
