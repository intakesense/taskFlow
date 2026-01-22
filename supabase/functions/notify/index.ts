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
    message_type: string
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

    // Get sender info
    const { data: sender } = await supabase
      .from('users')
      .select('name')
      .eq('id', record.sender_id)
      .single()

    // Get conversation members (excluding sender)
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', record.conversation_id)
      .neq('user_id', record.sender_id)

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    // Get OneSignal player IDs for recipients
    const userIds = members.map((m) => m.user_id)
    const { data: recipients } = await supabase
      .from('users')
      .select('id, onesignal_player_id')
      .in('id', userIds)
      .not('onesignal_player_id', 'is', null)

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No push subscribers' }), { status: 200 })
    }

    // Build notification content
    const senderName = sender?.name || 'Someone'
    let messagePreview = record.content
    if (record.message_type === 'voice') {
      messagePreview = 'Sent a voice message'
    } else if (record.message_type === 'image') {
      messagePreview = 'Sent an image'
    } else if (record.message_type === 'file') {
      messagePreview = 'Sent a file'
    } else if (messagePreview && messagePreview.length > 50) {
      messagePreview = messagePreview.substring(0, 50) + '...'
    }

    // Send notification via OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: userIds,
        headings: { en: senderName },
        contents: { en: messagePreview },
        url: `/?conversation=${record.conversation_id}`,
        chrome_web_icon: '/icon.svg',
        firefox_icon: '/icon.svg',
      }),
    })

    const result = await response.json()

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
