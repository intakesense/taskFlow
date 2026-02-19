import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

interface MessagePayload {
  type: 'INSERT'
  table: 'messages'
  record: {
    id: string
    conversation_id: string
    sender_id: string
    content: string
    file_url?: string
    file_name?: string
    file_type?: string
    message_type?: string
    created_at: string
  }
  schema: 'public'
}

Deno.serve(async (req) => {
  try {
    const payload: MessagePayload = await req.json()

    // Only handle new messages
    if (payload.type !== 'INSERT' || payload.table !== 'messages') {
      return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200 })
    }

    const { record } = payload
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // FIX M4: Parallel queries instead of sequential waterfall
    const [senderResult, membersResult] = await Promise.all([
      supabase
        .from('users')
        .select('name, avatar_url')
        .eq('id', record.sender_id)
        .single(),
      supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', record.conversation_id)
        .neq('user_id', record.sender_id),
    ])

    const sender = senderResult.data
    const members = membersResult.data

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    // FIX C2: Target by external_id (Supabase user ID) — no player ID lookup needed.
    // OneSignal.login(userId) links the external_id. OneSignal delivers to ALL subscribed
    // devices for each user automatically, including when browser data is cleared.
    const recipientExternalIds = members.map((m) => m.user_id)

    // Build notification content
    const senderName = sender?.name || 'Someone'

    // FIX M3: Proper deep link into the conversation
    const conversationUrl = `/messages?conversation=${record.conversation_id}`

    // Build message preview
    let messagePreview: string
    if (record.file_url && record.file_type?.startsWith('image/')) {
      messagePreview = '📷 Photo'
    } else if (record.file_url && record.file_type?.startsWith('video/')) {
      messagePreview = '🎥 Video'
    } else if (record.file_url) {
      messagePreview = `📎 ${record.file_name || 'File'}`
    } else if (record.message_type === 'voice') {
      messagePreview = '🎤 Voice message'
    } else if (record.content && record.content.length > 60) {
      messagePreview = record.content.substring(0, 60) + '…'
    } else {
      messagePreview = record.content || 'New message'
    }

    const notificationIcon = sender?.avatar_url || '/icon.svg'

    // FIX C1: Use `include_aliases` instead of deprecated `include_external_user_ids`
    // FIX M1: collapse_id = conversation_id — rapid messages collapse into one notification
    // FIX M2: priority:10 (high) + ios_interruption_level:active — cuts through battery-save mode
    // FIX M6: web_push_topic groups by conversation in notification center
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,

        // FIX C1: Correct 2026 targeting — was `include_external_user_ids`
        include_aliases: {
          external_id: recipientExternalIds,
        },
        target_channel: 'push',

        // Content
        headings: { en: senderName },
        contents: { en: messagePreview },

        // FIX M3: Deep link directly into the conversation
        url: conversationUrl,
        web_url: conversationUrl,

        chrome_web_icon: notificationIcon,
        firefox_icon: notificationIcon,
        large_icon: notificationIcon,
        small_icon: 'ic_notification',
        // Android Chrome notification tray badge icon
        chrome_web_badge: '/icons/icon-192x192.png',

        // FIX M1: Collapse rapid messages from same conversation into one notification
        collapse_id: record.conversation_id,

        // FIX M2: High priority delivery — cuts through battery-saving and Focus modes
        priority: 10,
        ios_interruption_level: 'active',

        // FIX M6: Group notifications by conversation in notification center (Chrome)
        web_push_topic: record.conversation_id,

        // Structured data for the service worker / notification click handler
        data: {
          conversation_id: record.conversation_id,
          sender_id: record.sender_id,
          sender_name: senderName,
          sender_avatar: sender?.avatar_url ?? null,
          message_id: record.id,
          type: 'chat_message',
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`OneSignal API error ${response.status}:`, errorBody)
      return new Response(JSON.stringify({ error: `OneSignal error: ${response.status}`, detail: errorBody }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await response.json()

    return new Response(JSON.stringify({ success: true, recipients: recipientExternalIds.length, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
