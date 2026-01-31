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
        let url = '/'
        let taskId = ''

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

            const { data: assigner } = await supabase
                .from('users')
                .select('name')
                .eq('id', task?.assigned_by)
                .single()

            title = 'New Task Assigned'
            body = `${assigner?.name || 'Someone'} assigned you: ${task?.title || 'New task'}`
            url = `/tasks/${taskId}`
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
                ...(assignees?.map(a => a.user_id) || []),
                record.assigned_by
            ].filter((id, i, arr) => arr.indexOf(id) === i)

            const statusLabels: Record<string, string> = {
                pending: 'Pending',
                in_progress: 'In Progress',
                on_hold: 'On Hold',
                completed: 'Completed',
                archived: 'Archived'
            }

            title = 'Task Updated'
            body = `"${record.title}" is now ${statusLabels[record.status] || record.status}`
            url = `/tasks/${taskId}`
        }
        // Handle task chat message
        else if (payload.table === 'task_messages' && payload.type === 'INSERT') {
            notificationType = 'task_message'
            const record = payload.record as { task_id: string; user_id: string; content: string; file_url?: string }
            taskId = record.task_id

            // Get sender info
            const { data: sender } = await supabase
                .from('users')
                .select('name')
                .eq('id', record.user_id)
                .single()

            // Get task info
            const { data: task } = await supabase
                .from('tasks')
                .select('title, assigned_by')
                .eq('id', taskId)
                .single()

            // Get all task participants (assignees + creator) except sender
            const { data: assignees } = await supabase
                .from('task_assignees')
                .select('user_id')
                .eq('task_id', taskId)

            recipientUserIds = [
                ...(assignees?.map(a => a.user_id) || []),
                task?.assigned_by
            ].filter((id): id is string => !!id && id !== record.user_id)
                .filter((id, i, arr) => arr.indexOf(id) === i)

            const messagePreview = record.file_url
                ? 'Sent an attachment'
                : record.content?.substring(0, 50) + (record.content?.length > 50 ? '...' : '')

            title = `${sender?.name || 'Someone'} in "${task?.title || 'Task'}"`
            body = messagePreview || 'New message'
            url = `/tasks/${taskId}`
        }
        else {
            return new Response(JSON.stringify({ message: 'Ignored' }), { status: 200 })
        }

        if (recipientUserIds.length === 0) {
            return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
        }

        // Get OneSignal player IDs
        const { data: recipients } = await supabase
            .from('users')
            .select('id, onesignal_player_id')
            .in('id', recipientUserIds)
            .not('onesignal_player_id', 'is', null)

        if (!recipients || recipients.length === 0) {
            return new Response(JSON.stringify({ message: 'No push subscribers' }), { status: 200 })
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
                include_external_user_ids: recipientUserIds,
                headings: { en: title },
                contents: { en: body },
                url: url,
                chrome_web_icon: '/icon.svg',
                firefox_icon: '/icon.svg',
                data: {
                    type: notificationType,
                    task_id: taskId,
                },
            }),
        })

        const result = await response.json()

        return new Response(JSON.stringify({ success: true, result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Task notification error:', error)
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
