import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { MessagesContainer } from '@/components/messages/messages-container'
import { redirect } from 'next/navigation'
import type { ConversationWithMembers, MessageWithSender, UserBasic, ConversationMemberWithUser } from '@/lib/types'

export const metadata = {
  title: 'Messages',
}

export default async function MessagesPage() {
  // Server-side auth check and data fetch
  const supabase = createClient(await cookies())

  // Validate user on server side
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect('/login')
  }

  // Fetch initial conversations on server for instant first paint
  const initialConversations = await fetchInitialConversations(supabase, user.id)

  // Pass initial data to client component - no loading spinner on first visit!
  return <MessagesContainer initialConversations={initialConversations} />
}

// Server-side conversation fetching (mirrors client-side logic)
async function fetchInitialConversations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ConversationWithMembers[]> {
  try {
    // Step 1: Get conversation IDs and membership data
    const { data: memberOf, error: memberError } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)

    if (memberError || !memberOf?.length) return []

    const conversationIds = memberOf.map((m) => m.conversation_id)

    // Step 2: Fetch ALL data in parallel
    const [conversationsResult, membersResult, messagesResult, unreadMessagesResult] = await Promise.all([
      supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false }),

      supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          last_read_at,
          joined_at,
          user:users!conversation_members_user_id_fkey(id, name, email, level)
        `)
        .in('conversation_id', conversationIds),

      supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(id, name, email, level)
        `)
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false }),

      supabase
        .from('messages')
        .select('conversation_id, created_at, sender_id')
        .in('conversation_id', conversationIds)
    ])

    if (conversationsResult.error) return []
    const conversations = conversationsResult.data || []

    // Step 3: Build lookup maps
    const membersByConv = new Map<string, UserBasic[]>()
    const membersWithStatusByConv = new Map<string, ConversationMemberWithUser[]>()
    const lastMessageByConv = new Map<string, MessageWithSender>()
    const unreadCountByConv = new Map<string, number>()

    // Process members
    if (membersResult.data) {
      membersResult.data.forEach((item: any) => {
        const convId = item.conversation_id
        const itemUser = item.user as UserBasic
        if (!membersByConv.has(convId)) {
          membersByConv.set(convId, [])
          membersWithStatusByConv.set(convId, [])
        }
        if (itemUser) {
          membersByConv.get(convId)!.push(itemUser)
          membersWithStatusByConv.get(convId)!.push({
            user: itemUser,
            last_read_at: item.last_read_at,
            joined_at: item.joined_at,
          })
        }
      })
    }

    // Process last messages
    if (messagesResult.data) {
      messagesResult.data.forEach((msg: any) => {
        if (!lastMessageByConv.has(msg.conversation_id)) {
          lastMessageByConv.set(msg.conversation_id, msg as MessageWithSender)
        }
      })
    }

    // Calculate unread counts
    if (unreadMessagesResult.data) {
      const membershipMap = new Map(memberOf.map((m) => [m.conversation_id, m.last_read_at]))

      unreadMessagesResult.data.forEach((msg: any) => {
        const lastReadAt = membershipMap.get(msg.conversation_id)
        if (lastReadAt && msg.created_at > lastReadAt && msg.sender_id !== userId) {
          unreadCountByConv.set(
            msg.conversation_id,
            (unreadCountByConv.get(msg.conversation_id) || 0) + 1
          )
        }
      })
    }

    // Step 4: Combine everything
    return conversations.map((conv) => ({
      ...conv,
      members: membersByConv.get(conv.id) || [],
      membersWithStatus: membersWithStatusByConv.get(conv.id) || [],
      lastMessage: lastMessageByConv.get(conv.id) || null,
      unreadCount: unreadCountByConv.get(conv.id) || 0,
    }))
  } catch {
    // If server fetch fails, return empty array - client will fetch on mount
    return []
  }
}
