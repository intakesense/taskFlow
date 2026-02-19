import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

type NotificationType = 'task_assigned' | 'task_status_changed' | 'task_message'

interface BasePayload {
    type: 'INSERT' | 'UPDATE'
    table: string
    record: Record<string, unknown>
    old_record?: Record<string, unknown>
    schema: 'public'
}

/** Send a push notification via OneSignal using External ID targeting (2026 API). */
async function sendPushNotification(params: {
    recipientUserIds: string[]
    title: string
    body: string
    url: string
    notificationType: NotificationType
    collapseId: string
    data?: Record<string, unknown>
}): Promise<void> {
    const { recipientUserIds, title, body, url, notificationType, collapseId, data } = params

    // FIX C1: Use `include_aliases` instead of deprecated `include_external_user_ids`
    // FIX C3: No player ID lookup — target by external_id (Supabase user ID). OneSignal
    // delivers to ALL subscribed devices for each user — no saved player ID needed.
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,

            // FIX C1: Correct 2026 targeting
            include_aliases: {
                external_id: recipientUserIds,
            },
            target_channel: 'push',

            headings: { en: title },
            contents: { en: body },
            url,
            web_url: url,

            chrome_web_icon: '/icon.svg',
            firefox_icon: '/icon.svg',
            chrome_web_badge: '/icons/icon-192x192.png',

            // FIX M1 (tasks): Collapse multiple updates on the same task into one notification
            collapse_id: collapseId,

            // FIX M2: High priority — cuts through battery-saving and Focus modes
            priority: 10,
            ios_interruption_level: 'active',

            // Group task notifications in notification center (Chrome)
            web_push_topic: collapseId,

            data: {
                type: notificationType,
                ...data,
            },
        }),
    })

    if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`OneSignal API error ${response.status}: ${errorBody}`)
    }
}

Deno.serve(async (req) => {
    try {
        const payload: BasePayload = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        let notificationType: NotificationType
        let recipientUserIds: string[] = []
        let title = ''
        let body = ''
        let url = '/tasks'
        let taskId = ''
        let extraData: Record<string, unknown> = {}

        // ── Handle task assignment ──────────────────────────────────────────────
        if (payload.table === 'task_assignees' && payload.type === 'INSERT') {
            notificationType = 'task_assigned'
            const record = payload.record as { task_id: string; user_id: string }
            recipientUserIds = [record.user_id]
            taskId = record.task_id

            // Note: genuinely sequential — assigner's user ID lives inside the task record,
            // so we must fetch the task first before we can look up the assigner's name.
            const { data: task } = await supabase
                .from('tasks')
                .select('id, title, assigned_by')
                .eq('id', taskId)
                .single()

            const { data: assigner } = task?.assigned_by
                ? await supabase.from('users').select('name').eq('id', task.assigned_by).single()
                : { data: null }

            title = '📋 New Task Assigned'
            body = `${assigner?.name || 'Someone'} assigned you: ${task?.title || 'New task'}`
            url = `/tasks/${taskId}`
            extraData = { task_id: taskId }
        }

        // ── Handle task status change ────────────────────────────────────────────
        else if (payload.table === 'tasks' && payload.type === 'UPDATE') {
            const record = payload.record as { id: string; title: string; status: string; assigned_by: string }
            const oldRecord = payload.old_record as { status: string } | undefined

            // Only notify on actual status changes
            if (!oldRecord || oldRecord.status === record.status) {
                return new Response(JSON.stringify({ message: 'No status change' }), { status: 200 })
            }

            notificationType = 'task_status_changed'
            taskId = record.id

            const { data: assignees } = await supabase
                .from('task_assignees')
                .select('user_id')
                .eq('task_id', taskId)

            // Notify assignees + creator, deduped
            recipientUserIds = [
                ...(assignees?.map((a) => a.user_id) || []),
                record.assigned_by,
            ].filter((id, i, arr) => !!id && arr.indexOf(id) === i)

            const statusLabels: Record<string, string> = {
                pending: 'Pending',
                in_progress: 'In Progress',
                on_hold: 'On Hold',
                completed: 'Completed ✅',
                archived: 'Archived',
            }

            title = '📋 Task Updated'
            body = `"${record.title}" is now ${statusLabels[record.status] || record.status}`
            url = `/tasks/${taskId}`
            extraData = { task_id: taskId, new_status: record.status }
        }

        // ── Handle task chat message ─────────────────────────────────────────────
        else if (payload.table === 'task_messages' && payload.type === 'INSERT') {
            notificationType = 'task_message'
            const record = payload.record as { task_id: string; user_id: string; content: string; file_url?: string }
            taskId = record.task_id

            // Parallel: fetch sender + task + assignees simultaneously
            const [senderResult, taskResult, assigneesResult] = await Promise.all([
                supabase.from('users').select('name').eq('id', record.user_id).single(),
                supabase.from('tasks').select('title, assigned_by').eq('id', taskId).single(),
                supabase.from('task_assignees').select('user_id').eq('task_id', taskId),
            ])

            const sender = senderResult.data
            const task = taskResult.data
            const assignees = assigneesResult.data

            recipientUserIds = [
                ...(assignees?.map((a) => a.user_id) || []),
                task?.assigned_by,
            ].filter((id): id is string => !!id && id !== record.user_id)
                .filter((id, i, arr) => arr.indexOf(id) === i)

            const messagePreview = record.file_url
                ? '📎 Sent an attachment'
                : record.content?.substring(0, 60) + (record.content?.length > 60 ? '…' : '')

            title = `${sender?.name || 'Someone'} in "${task?.title || 'Task'}"`
            body = messagePreview || 'New message'
            url = `/tasks/${taskId}`
            extraData = { task_id: taskId }
        }

        else {
            return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200 })
        }

        if (recipientUserIds.length === 0) {
            return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
        }

        await sendPushNotification({
            recipientUserIds,
            title,
            body,
            url,
            notificationType,
            collapseId: taskId, // Collapse multiple task updates into one notification
            data: extraData,
        })

        return new Response(
            JSON.stringify({ success: true, recipients: recipientUserIds.length }),
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
