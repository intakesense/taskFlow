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
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/**
 * Context passed to agent tools
 * Contains the logged-in user's ID for performing actions on their behalf
 */
export interface AgentContext {
  userId: string
  userName: string
}

/**
 * Tool 1: Get all users
 *
 * Discovery tool - AI calls this first to know who exists in the system.
 * Returns a list of users with their IDs and names.
 */
export const getUsersTool = tool({
  name: 'get_users',
  description: 'Get a list of all users who can receive messages. Call this first before sending any message to know who is available and get their IDs.',
  parameters: z.object({}),
  execute: async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email')
      .order('name', { ascending: true })

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
 * Action tool - AI calls this after discovering users with get_users.
 * Creates or gets an existing DM conversation and sends the message.
 */
export const sendMessageTool = (context: AgentContext) => tool({
  name: 'send_message',
  description: `Send a direct message to a user on behalf of ${context.userName}. You MUST call get_users first to get the recipient's ID. The message will be sent from ${context.userName}'s account.`,
  parameters: z.object({
    recipientId: z.string().describe('The user ID (UUID) of the recipient. Get this from get_users.'),
    message: z.string().describe('The message content to send.'),
  }),
  execute: async ({ recipientId, message }) => {
    const senderId = context.userId

    console.log('[AgentTools] Sending message:', { senderId, recipientId, messageLength: message.length })

    try {
      // Step 1: Get or create DM conversation
      const conversation = await getOrCreateDMConversation(senderId, recipientId)

      if (!conversation) {
        return { success: false, error: 'Failed to create conversation' }
      }

      // Step 2: Send the message
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: senderId,
          content: message,
        })
        .select('id')
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
 * Helper: Get or create a DM conversation between two users
 * Mirrors the logic from use-conversations.ts
 */
async function getOrCreateDMConversation(userId: string, otherUserId: string) {
  const isSelfChat = userId === otherUserId

  // Check if DM already exists
  const { data: existing, error: existingError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)

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

      const expectedMemberCount = isSelfChat ? 1 : 2
      if (members?.length === expectedMemberCount) {
        const memberIds = members.map((m: { user_id: string }) => m.user_id)
        const isMatch = isSelfChat
          ? memberIds[0] === userId
          : memberIds.includes(otherUserId) && memberIds.includes(userId)

        if (isMatch) {
          const { data: convData } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conv.conversation_id)
            .eq('is_group', false)
            .single()

          if (convData) return convData
        }
      }
    }
  }

  // Create new DM
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ created_by: userId, is_group: false })
    .select()
    .single()

  if (convError) {
    console.error('[AgentTools] Failed to create conversation:', convError)
    return null
  }

  // Add members
  const membersToAdd = isSelfChat
    ? [{ conversation_id: newConv.id, user_id: userId }]
    : [
        { conversation_id: newConv.id, user_id: userId },
        { conversation_id: newConv.id, user_id: otherUserId },
      ]

  const { error: memberError } = await supabase
    .from('conversation_members')
    .insert(membersToAdd)

  if (memberError) {
    console.error('[AgentTools] Failed to add members:', memberError)
    // Clean up orphaned conversation
    await supabase.from('conversations').delete().eq('id', newConv.id)
    return null
  }

  return newConv
}

/**
 * Get all tools for the AI agent, configured with the given user context.
 *
 * The context is needed because send_message needs to know which user
 * is sending the message (the logged-in user).
 */
export function getAgentTools(context: AgentContext) {
  return [
    getUsersTool,
    sendMessageTool(context),
  ]
}