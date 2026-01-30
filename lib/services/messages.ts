import { createClient } from '@/lib/supabase/client'
import { TaskMessage, TaskMessageWithSender } from '@/lib/types'
import { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { logError } from '@/lib/utils/error'

function getSupabase() { return createClient() }

export async function getTaskMessages(taskId: string): Promise<TaskMessageWithSender[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_messages')
        .select(`
            *,
            sender:users!task_messages_sender_id_fkey(*)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

    if (error) {
        logError('getTaskMessages', error)
        throw error
    }
    return data as TaskMessageWithSender[]
}

export async function sendMessage(taskId: string, senderId: string, message: string): Promise<TaskMessage> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_messages')
        .insert({
            task_id: taskId,
            sender_id: senderId,
            message
        })
        .select()
        .single()

    if (error) {
        logError('sendMessage', error)
        throw error
    }
    return data as TaskMessage
}

export function subscribeToMessages(taskId: string, callback: (payload: RealtimePostgresInsertPayload<TaskMessage>) => void): RealtimeChannel {
    const supabase = getSupabase()
    return supabase
        .channel(`task-messages:${taskId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'task_messages',
                filter: `task_id=eq.${taskId}`
            },
            callback
        )
        .subscribe()
}

export function unsubscribeFromMessages(channel: RealtimeChannel) {
    const supabase = getSupabase()
    supabase.removeChannel(channel)
}
