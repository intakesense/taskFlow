/**
 * Google Calendar API route.
 * Handles create, update, and delete of calendar events for task due dates.
 * Called server-side only — access token never exposed to client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAccessToken } from '@/lib/google/tokens'
import { cookies } from 'next/headers'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// POST /api/google/calendar — create or update a calendar event for a task
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { taskId, title, dueDate, description, eventId } = body as {
            taskId: string
            title: string
            dueDate: string
            description?: string
            eventId?: string
        }

        if (!taskId || !title || !dueDate) {
            return NextResponse.json({ error: 'taskId, title, dueDate required' }, { status: 400 })
        }

        // #3 fix: if updating, verify this eventId belongs to the caller in our DB
        if (eventId) {
            const { data: owned } = await supabase
                .from('task_calendar_events')
                .select('event_id')
                .eq('event_id', eventId)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!owned) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        const accessToken = await getGoogleAccessToken(user.id)

        const date = dueDate.split('T')[0]
        const event = {
            summary: title,
            description: description
                ? `${description}\n\nManaged by TaskFlow`
                : 'Managed by TaskFlow',
            start: { date },
            end: { date },
            extendedProperties: {
                private: { taskflowTaskId: taskId },
            },
        }

        let res: Response
        if (eventId) {
            res = await fetch(`${CALENDAR_API}/${eventId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            })
        } else {
            res = await fetch(CALENDAR_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            })
        }

        if (!res.ok) {
            console.error('Google Calendar API error:', res.status)
            return NextResponse.json({ error: 'Google Calendar API error' }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json({ eventId: data.id, htmlLink: data.htmlLink })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.startsWith('NO_GOOGLE_TOKEN') || message.startsWith('NO_REFRESH_TOKEN') || message.startsWith('REFRESH_FAILED')) {
            return NextResponse.json({ error: message, code: 'NO_TOKEN' }, { status: 403 })
        }
        console.error('Calendar route error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/google/calendar — delete a calendar event when task is done/deleted
export async function DELETE(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { eventId } = await req.json() as { eventId: string }
        if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

        // #3 fix: verify this eventId belongs to the caller in our DB before touching Google
        const { data: owned } = await supabase
            .from('task_calendar_events')
            .select('event_id')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .maybeSingle()

        if (!owned) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const accessToken = await getGoogleAccessToken(user.id)

        const res = await fetch(`${CALENDAR_API}/${eventId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        // 404 is fine — event may have been deleted manually by user
        if (!res.ok && res.status !== 404) {
            console.error('Google Calendar delete error:', res.status)
            return NextResponse.json({ error: 'Google Calendar API error' }, { status: res.status })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.startsWith('NO_GOOGLE_TOKEN') || message.startsWith('NO_REFRESH_TOKEN') || message.startsWith('REFRESH_FAILED')) {
            return NextResponse.json({ error: message, code: 'NO_TOKEN' }, { status: 403 })
        }
        console.error('Calendar delete route error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
