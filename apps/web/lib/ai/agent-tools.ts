/**
 * AI Agent Tools for Voice Bot
 *
 * Implements the two-tool pattern for messaging:
 * 1. get_users - Fetches all users (discovery)
 * 2. send_message - Sends a message to a user by ID (action)
 *
 * Based on OpenAI Agents SDK: https://openai.github.io/openai-agents-js/guides/voice-agents/build/
 */

import { tool } from '@openai/agents'
import type { RunContext } from '@openai/agents'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Context passed to agent tools via RealtimeSession({ context }).
 * The SDK threads this through as context?.context inside RunContext<RealtimeContextData<AgentContext>>.
 */
export interface AgentContext {
  userId: string
  userName: string
}

/**
 * Tool 1: Get all users
 *
 * Discovery tool — AI calls this first to know who exists.
 * Bot user is filtered out so the AI cannot "send a message to Bot".
 */
export const getUsersTool = tool({
  name: 'get_users',
  description: 'Get a list of all users who can receive messages. Call this first before sending any message to know who is available and get their IDs.',
  parameters: z.object({}),
  timeoutMs: 8000,
  timeoutBehavior: 'error_as_result',
  timeoutErrorFunction: () => "I couldn't reach the server in time. Please try again.",
  errorFunction: (_context: RunContext, error: unknown) => {
    console.error('[AgentTools] get_users error:', error)
    return "I couldn't fetch the user list right now. Please try again."
  },
  execute: async (_input, _context, details) => {
    const supabase = createClient()

    // .abortSignal() must be chained before any terminal call.
    // This query has no .single() so signal chains directly on the builder.
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email')
      .neq('id', AI_BOT_USER_ID)
      .order('name', { ascending: true })
      .abortSignal(details?.signal ?? new AbortController().signal)

    if (error) {
      console.error('[AgentTools] Failed to fetch users:', error)
      return { success: false, error: 'Failed to fetch users' }
    }

    return {
      success: true,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })),
    }
  },
})

/**
 * Tool 2: Send a message
 *
 * Action tool — AI calls this after discovering users with get_users.
 * Creates or gets an existing DM conversation and sends the message.
 */
export const sendMessageTool = (context: AgentContext) => tool({
  name: 'send_message',
  description: `Send a direct message to a user on behalf of ${context.userName}. You MUST call get_users first to get the recipient's ID. The message will be sent from ${context.userName}'s account.`,
  parameters: z.object({
    recipientId: z.string().describe('The user ID (UUID) of the recipient. Get this from get_users.'),
    message: z.string().describe('The message content to send.'),
  }),
  timeoutMs: 8000,
  timeoutBehavior: 'error_as_result',
  timeoutErrorFunction: () => "I couldn't reach the server in time. The message may not have been sent. Please try again.",
  errorFunction: (_runContext: RunContext, error: unknown) => {
    console.error('[AgentTools] send_message error:', error)
    return "Something went wrong while sending the message. Please try again."
  },
  execute: async ({ recipientId, message }, _runContext, details) => {
    const senderId = context.userId
    const supabase = createClient()
    const signal = details?.signal

    console.log('[AgentTools] Sending message:', { senderId, recipientId, messageLength: message.length })

    try {
      // Step 1: Get or create DM conversation
      const conversation = await getOrCreateDMConversation(supabase, senderId, recipientId, signal)

      if (!conversation) {
        return { success: false, error: 'Failed to create conversation' }
      }

      // Step 2: Send the message
      // .abortSignal() must come before .single() in the chain
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: senderId,
          content: message,
        })
        .select('id')
        .abortSignal(signal ?? new AbortController().signal)
        .single()

      if (msgError) {
        console.error('[AgentTools] Failed to send message:', msgError)
        return { success: false, error: 'Failed to send message' }
      }

      // Step 3: Get recipient name for confirmation
      const { data: recipient } = await supabase
        .from('users')
        .select('name')
        .eq('id', recipientId)
        .abortSignal(signal ?? new AbortController().signal)
        .single()

      console.log('[AgentTools] Message sent successfully:', newMessage.id)

      return {
        success: true,
        messageId: newMessage.id,
        recipientName: recipient?.name || 'Unknown',
        message: `Message sent to ${recipient?.name || 'the user'}`,
      }
    } catch (error) {
      console.error('[AgentTools] Error sending message:', error)
      return { success: false, error: 'An error occurred while sending the message' }
    }
  },
})

/**
 * Helper: Get or create a DM conversation between two users.
 */
async function getOrCreateDMConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  otherUserId: string,
  signal?: AbortSignal,
) {
  const isSelfChat = userId === otherUserId
  const sig = signal ?? new AbortController().signal

  // Check existing conversations for this user
  const { data: existing, error: existingError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)
    .abortSignal(sig)

  if (existingError) {
    console.error('[AgentTools] Failed to check existing conversations:', existingError)
    return null
  }

  if (existing?.length) {
    for (const conv of existing) {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.conversation_id)
        .abortSignal(sig)

      const expectedMemberCount = isSelfChat ? 1 : 2
      if (members?.length === expectedMemberCount) {
        const memberIds = members.map((m: { user_id: string }) => m.user_id)
        const isMatch = isSelfChat
          ? memberIds[0] === userId
          : memberIds.includes(otherUserId) && memberIds.includes(userId)

        if (isMatch) {
          // .abortSignal() before .single()
          const { data: convData } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conv.conversation_id)
            .eq('is_group', false)
            .abortSignal(sig)
            .single()

          if (convData) return convData
        }
      }
    }
  }

  // Create new DM — .abortSignal() before .single()
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ created_by: userId, is_group: false })
    .select()
    .abortSignal(sig)
    .single()

  if (convError) {
    console.error('[AgentTools] Failed to create conversation:', convError)
    return null
  }

  const membersToAdd = isSelfChat
    ? [{ conversation_id: newConv.id, user_id: userId }]
    : [
        { conversation_id: newConv.id, user_id: userId },
        { conversation_id: newConv.id, user_id: otherUserId },
      ]

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert(membersToAdd)
    .abortSignal(sig)

  if (memberError) {
    console.error('[AgentTools] Failed to add members:', memberError)
    await supabase.from('conversations').delete().eq('id', newConv.id)
    return null
  }

  return newConv
}

/**
 * Get all tools for the AI agent, configured with the given user context.
 */
export function getAgentTools(context: AgentContext) {
  return [
    getUsersTool,
    sendMessageTool(context),
  ]
}
