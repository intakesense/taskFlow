import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Firebase Admin SDK credentials (set via `supabase secrets set`)
function getFirebaseConfig() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY secrets.')
  }

  return { projectId, clientEmail, privateKey }
}

interface NotificationPayload {
  // For direct API calls
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, string>
  deepLink?: string
  tag?: string
  // For database trigger calls
  type?: 'INSERT'
  table?: string
  record?: Record<string, unknown>
}

interface FCMMessage {
  token: string
  notification: {
    title: string
    body: string
  }
  data?: Record<string, string>
  android?: {
    priority: 'high' | 'normal'
    notification?: {
      channelId?: string
      icon?: string
      tag?: string
    }
  }
  apns?: {
    payload: {
      aps: {
        sound?: string
        badge?: number
        'thread-id'?: string
      }
    }
  }
  webpush?: {
    headers?: Record<string, string>
    notification?: {
      icon?: string
      badge?: string
      tag?: string
    }
    fcmOptions?: {
      link?: string
    }
  }
}

// Get OAuth2 access token for FCM v1 API
async function getAccessToken(): Promise<string> {
  const { clientEmail } = getFirebaseConfig()
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }

  // Encode JWT
  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Sign with RSA-SHA256
  const { privateKey: privateKeyPem } = getFirebaseConfig()
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(unsignedToken))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const jwt = `${unsignedToken}.${signatureB64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function sendFCMMessage(accessToken: string, message: FCMMessage): Promise<{ success: boolean; error?: string }> {
  const { projectId } = getFirebaseConfig()
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`FCM error for token ${message.token.substring(0, 20)}...:`, error)
    return { success: false, error }
  }

  return { success: true }
}

Deno.serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Handle database trigger for messages
    if (payload.type === 'INSERT' && payload.table === 'messages' && payload.record) {
      return await handleMessageNotification(supabase, payload.record)
    }

    // Handle direct API call
    if (!payload.userIds || payload.userIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No user IDs provided' }), { status: 400 })
    }

    // Fetch device tokens for target users
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('token, platform, user_id')
      .in('user_id', payload.userIds)

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError)
      return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No registered devices' }), { status: 200 })
    }

    // Get access token
    const accessToken = await getAccessToken()

    // Send to all devices
    const results = await Promise.allSettled(
      tokens.map((t) => {
        const message: FCMMessage = {
          token: t.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            deepLink: payload.deepLink || '/',
            ...payload.data,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'messages',
              icon: 'ic_notification',
              tag: payload.tag,
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                'thread-id': payload.tag,
              },
            },
          },
          webpush: {
            notification: {
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-192x192.png',
              tag: payload.tag,
            },
            fcmOptions: {
              link: payload.deepLink,
            },
          },
        }
        return sendFCMMessage(accessToken, message)
      })
    )

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    // Clean up invalid tokens
    const invalidTokens: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && !r.value.success && r.value.error?.includes('UNREGISTERED')) {
        invalidTokens.push(tokens[i].token)
      }
    })

    if (invalidTokens.length > 0) {
      await supabase.from('device_tokens').delete().in('token', invalidTokens)
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens`)
    }

    return new Response(
      JSON.stringify({ success: true, sent: successful, failed, cleaned: invalidTokens.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// Handle message insert notifications (called from database trigger)
async function handleMessageNotification(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
): Promise<Response> {
  const messageId = record.id as string
  const conversationId = record.conversation_id as string
  const senderId = record.sender_id as string
  const content = record.content as string
  const fileUrl = record.file_url as string | undefined
  const fileType = record.file_type as string | undefined
  const fileName = record.file_name as string | undefined
  const messageType = record.message_type as string | undefined

  // Get sender info and conversation members in parallel
  const [senderResult, membersResult] = await Promise.all([
    supabase.from('users').select('name, avatar_url').eq('id', senderId).single(),
    supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId),
  ])

  const sender = senderResult.data
  const members = membersResult.data

  if (!members || members.length === 0) {
    return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
  }

  const recipientIds = members.map((m) => m.user_id)

  // Fetch device tokens
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform, user_id')
    .in('user_id', recipientIds)

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ message: 'No registered devices' }), { status: 200 })
  }

  // Build message preview
  let messagePreview: string
  if (fileUrl && fileType?.startsWith('image/')) {
    messagePreview = 'Photo'
  } else if (fileUrl && fileType?.startsWith('video/')) {
    messagePreview = 'Video'
  } else if (fileUrl) {
    messagePreview = fileName || 'File'
  } else if (messageType === 'voice') {
    messagePreview = 'Voice message'
  } else if (content && content.length > 60) {
    messagePreview = content.substring(0, 60) + '...'
  } else {
    messagePreview = content || 'New message'
  }

  const senderName = sender?.name || 'Someone'
  const deepLink = `/?conversation=${conversationId}`

  // Get access token
  const accessToken = await getAccessToken()

  // Send to all devices
  const results = await Promise.allSettled(
    tokens.map((t) => {
      const message: FCMMessage = {
        token: t.token,
        notification: {
          title: senderName,
          body: messagePreview,
        },
        data: {
          conversation_id: conversationId,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar: sender?.avatar_url || '',
          message_id: messageId,
          type: 'chat_message',
          deepLink,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messages',
            icon: 'ic_notification',
            tag: conversationId,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'thread-id': conversationId,
            },
          },
        },
        webpush: {
          notification: {
            icon: sender?.avatar_url || '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: conversationId,
          },
          fcmOptions: {
            link: deepLink,
          },
        },
      }
      return sendFCMMessage(accessToken, message)
    })
  )

  const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length

  return new Response(
    JSON.stringify({ success: true, recipients: recipientIds.length, sent: successful }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
