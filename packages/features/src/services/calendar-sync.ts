'use client';

/**
 * Client-side Google Calendar sync service.
 * Calls the web API route which handles token management server-side.
 * Works in both Next.js (web) and Tauri (Tauri calls the deployed web API
 * via VITE_API_BASE_URL; web uses empty string for relative paths).
 *
 * All operations are fire-and-forget — failures are non-fatal and
 * should never block the task mutation that triggered them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface SyncTaskToCalendarParams {
    supabase: SupabaseClient
    apiBaseUrl: string
    taskId: string
    title: string
    dueDate: string
    description?: string
    userId: string
}

interface CalendarEventRecord {
    event_id: string
}

export async function syncTaskToCalendar({
    supabase,
    apiBaseUrl,
    taskId,
    title,
    dueDate,
    description,
    userId,
}: SyncTaskToCalendarParams): Promise<void> {
    const { data: existing } = await supabase
        .from('task_calendar_events')
        .select('event_id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .maybeSingle()

    const existingRecord = existing as CalendarEventRecord | null

    const res = await fetch(`${apiBaseUrl}/api/google/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            taskId,
            title,
            dueDate,
            description,
            eventId: existingRecord?.event_id ?? undefined,
        }),
    })

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.code === 'NO_TOKEN') return
        console.error('Calendar sync failed:', res.status)
        return
    }

    const { eventId } = await res.json()

    await supabase.from('task_calendar_events').upsert({
        task_id: taskId,
        user_id: userId,
        event_id: eventId,
    }, { onConflict: 'task_id,user_id' })
}

export async function removeTaskFromCalendar({
    supabase,
    apiBaseUrl,
    taskId,
    userId,
}: {
    supabase: SupabaseClient
    apiBaseUrl: string
    taskId: string
    userId: string
}): Promise<void> {
    const { data: existing } = await supabase
        .from('task_calendar_events')
        .select('event_id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .maybeSingle()

    const existingRecord = existing as CalendarEventRecord | null
    if (!existingRecord?.event_id) return

    const res = await fetch(`${apiBaseUrl}/api/google/calendar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: existingRecord.event_id }),
    })

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.code === 'NO_TOKEN') return
        console.error('Calendar remove failed:', res.status)
        return
    }

    await supabase
        .from('task_calendar_events')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId)
}
