import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Firebase Admin SDK credentials
function getFirebaseConfig() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase configuration')
  }

  return { projectId, clientEmail, privateKey }
}

type NotificationType = 'task_assigned' | 'task_status_changed' | 'task_message' | 'task_progress' | 'task_progress_comment'

interface BasePayload {
    type: 'INSERT' | 'UPDATE'
    table: string
    record: Record<string, unknown>
    old_record?: Record<string, unknown>
    schema: 'public'
}

interface FCMMessage {
  token: string
  notification: { title: string; body: string }
  data?: Record<string, string>
  android?: { priority: 'high' | 'normal'; notification?: { channelId?: string; icon?: string; tag?: string } }
  apns?: { payload: { aps: { sound?: string; badge?: number; 'thread-id'?: string } } }
  webpush?: { notification?: { icon?: string; badge?: string; tag?: string }; fcmOptions?: { link?: string } }
}

// Get OAuth2 access token for FCM v1 API
async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey: privateKeyPem } = getFirebaseConfig()
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

  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${headerB64}.${payloadB64}`

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

async function sendFCMMessage(accessToken: string, message: FCMMessage): Promise<boolean> {
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
  return response.ok
}

/** Send push notifications via FCM to all user devices */
async function sendPushNotification(
  supabase: ReturnType<typeof createClient>,
  params: {
    recipientUserIds: string[]
    title: string
    body: string
    url: string
    notificationType: NotificationType
    collapseId: string
    data?: Record<string, unknown>
  }
): Promise<number> {
  const { recipientUserIds, title, body, url, notificationType, collapseId, data } = params

  // Fetch device tokens for all recipients
  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token, platform, user_id')
    .in('user_id', recipientUserIds)

  if (!tokens || tokens.length === 0) {
    return 0
  }

  const accessToken = await getAccessToken()

  const results = await Promise.allSettled(
    tokens.map((t) => {
      const message: FCMMessage = {
        token: t.token,
        notification: { title, body },
        data: {
          type: notificationType,
          deepLink: url,
          ...Object.fromEntries(
            Object.entries(data || {}).map(([k, v]) => [k, String(v)])
          ),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'tasks',
            icon: 'ic_notification',
            tag: collapseId,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'thread-id': collapseId,
            },
          },
        },
        webpush: {
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: collapseId,
          },
          fcmOptions: {
            link: url,
          },
        },
      }
      return sendFCMMessage(accessToken, message)
    })
  )

  return results.filter((r) => r.status === 'fulfilled' && r.value).length
}

Deno.serve(async (req) => {
  try {
    const payload: BasePayload = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let notificationType: NotificationType
    let recipientUserIds: string[] = []
    let title = ''
    let body = ''
    let url = '/tasks'
    let taskId = ''
    let extraData: Record<string, unknown> = {}

    // Handle task assignment
    if (payload.table === 'task_assignees' && payload.type === 'INSERT') {
      notificationType = 'task_assigned'
      const record = payload.record as { task_id: string; user_id: string }
      recipientUserIds = [record.user_id]
      taskId = record.task_id

      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, assigned_by')
        .eq('id', taskId)
        .single()

      const { data: assigner } = task?.assigned_by
        ? await supabase.from('users').select('name').eq('id', task.assigned_by).single()
        : { data: null }

      title = 'New Task Assigned'
      body = `${assigner?.name || 'Someone'} assigned you: ${task?.title || 'New task'}`
      url = `/tasks/${taskId}`
      extraData = { task_id: taskId }
    }

    // Handle task status change
    else if (payload.table === 'tasks' && payload.type === 'UPDATE') {
      const record = payload.record as { id: string; title: string; status: string; assigned_by: string }
      const oldRecord = payload.old_record as { status: string } | undefined

      if (!oldRecord || oldRecord.status === record.status) {
        return new Response(JSON.stringify({ message: 'No status change' }), { status: 200 })
      }

      notificationType = 'task_status_changed'
      taskId = record.id

      const { data: assignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', taskId)

      recipientUserIds = [
        ...(assignees?.map((a) => a.user_id) || []),
        record.assigned_by,
      ].filter((id, i, arr) => !!id && arr.indexOf(id) === i)

      const statusLabels: Record<string, string> = {
        pending: 'Pending',
        in_progress: 'In Progress',
        on_hold: 'On Hold',
        completed: 'Completed',
        archived: 'Archived',
      }

      title = 'Task Updated'
      body = `"${record.title}" is now ${statusLabels[record.status] || record.status}`
      url = `/tasks/${taskId}`
      extraData = { task_id: taskId, new_status: record.status }
    }

    // Handle task messages
    else if (payload.table === 'task_messages' && payload.type === 'INSERT') {
      const record = payload.record as {
        task_id: string
        sender_id: string
        content: string
        file_url?: string
        type?: 'message' | 'progress'
        reply_to_id?: string | null
      }
      taskId = record.task_id
      const messageType = record.type || 'message'
      const isProgressComment = messageType === 'progress' && !!record.reply_to_id

      if (isProgressComment) {
        notificationType = 'task_progress_comment'
      } else if (messageType === 'progress') {
        notificationType = 'task_progress'
      } else {
        notificationType = 'task_message'
      }

      const [senderResult, taskResult, assigneesResult] = await Promise.all([
        supabase.from('users').select('name').eq('id', record.sender_id).single(),
        supabase.from('tasks').select('title, assigned_by').eq('id', taskId).single(),
        supabase.from('task_assignees').select('user_id').eq('task_id', taskId),
      ])

      const sender = senderResult.data
      const task = taskResult.data
      const assignees = assigneesResult.data

      recipientUserIds = [
        ...(assignees?.map((a) => a.user_id) || []),
        task?.assigned_by,
      ].filter((id): id is string => !!id && id !== record.sender_id)
        .filter((id, i, arr) => arr.indexOf(id) === i)

      if (isProgressComment) {
        const commentPreview = record.content?.substring(0, 50) + (record.content?.length > 50 ? '...' : '')
        title = `${sender?.name || 'Someone'} commented`
        body = `On "${task?.title || 'Task'}": ${commentPreview || 'New comment'}`
      } else if (messageType === 'progress') {
        const progressPreview = record.content?.substring(0, 60) + (record.content?.length > 60 ? '...' : '')
        title = 'Progress Update'
        body = `${sender?.name || 'Someone'} on "${task?.title || 'Task'}": ${progressPreview || 'Posted an update'}`
      } else {
        const messagePreview = record.file_url
          ? 'Sent an attachment'
          : record.content?.substring(0, 60) + (record.content?.length > 60 ? '...' : '')
        title = `${sender?.name || 'Someone'} in "${task?.title || 'Task'}"`
        body = messagePreview || 'New message'
      }

      url = `/tasks/${taskId}`
      extraData = { task_id: taskId, message_type: messageType }
    }

    else {
      return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200 })
    }

    if (recipientUserIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const sent = await sendPushNotification(supabase, {
      recipientUserIds,
      title,
      body,
      url,
      notificationType,
      collapseId: taskId,
      data: extraData,
    })

    return new Response(
      JSON.stringify({ success: true, recipients: recipientUserIds.length, sent }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Task notification error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
