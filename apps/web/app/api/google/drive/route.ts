/**
 * Google Drive API route.
 * Handles: attach a Drive file to a task or message, and share it with participants.
 * Called by the Drive Picker component after the user selects a file.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGoogleAccessToken } from '@/lib/google/tokens'
import { cookies } from 'next/headers'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'

interface AttachDriveFileBody {
    fileId: string
    fileName: string
    mimeType: string
    webViewLink: string
    iconLink?: string
    // Context: one of these must be set
    taskId?: string
    messageId?: string
}

// POST /api/google/drive — attach a file and share it with participants
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json() as AttachDriveFileBody
        const { fileId, fileName, mimeType, webViewLink, iconLink, taskId, messageId } = body

        if (!fileId || !fileName || !mimeType || !webViewLink) {
            return NextResponse.json({ error: 'fileId, fileName, mimeType, webViewLink required' }, { status: 400 })
        }
        if (!taskId && !messageId) {
            return NextResponse.json({ error: 'taskId or messageId required' }, { status: 400 })
        }

        const accessToken = await getGoogleAccessToken(user.id)

        // Collect participant emails to share with
        const participantEmails = await getParticipantEmails({ taskId, messageId, uploaderId: user.id })

        // Share file with each participant (reader access)
        await shareFileWithParticipants(accessToken, fileId, participantEmails)

        // Store attachment metadata
        const admin = createAdminClient()
        const { data: attachment, error } = await admin
            .from('drive_attachments')
            .insert({
                uploader_id: user.id,
                task_id: taskId ?? null,
                message_id: messageId ?? null,
                file_id: fileId,
                file_name: fileName,
                mime_type: mimeType,
                web_view_link: webViewLink,
                icon_link: iconLink ?? null,
            })
            .select()
            .single()

        if (error) {
            console.error('Failed to save drive attachment:', error)
            return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 })
        }

        return NextResponse.json({ attachment, sharedWith: participantEmails.length })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.startsWith('NO_GOOGLE_TOKEN') || message.startsWith('NO_REFRESH_TOKEN') || message.startsWith('REFRESH_FAILED')) {
            return NextResponse.json({ error: message, code: 'NO_TOKEN' }, { status: 403 })
        }
        console.error('Drive route error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET /api/google/drive?taskId=xxx or ?messageId=xxx — list attachments for a context
export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const taskId = searchParams.get('taskId')
        const messageId = searchParams.get('messageId')

        if (!taskId && !messageId) {
            return NextResponse.json({ error: 'taskId or messageId required' }, { status: 400 })
        }

        let query = supabase.from('drive_attachments').select('*')
        if (taskId) query = query.eq('task_id', taskId)
        if (messageId) query = query.eq('message_id', messageId)

        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ attachments: data })
    } catch (err) {
        console.error('Drive GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// --- Helpers ---

async function getParticipantEmails({
    taskId,
    messageId,
    uploaderId,
}: {
    taskId?: string
    messageId?: string
    uploaderId: string
}): Promise<string[]> {
    // Use admin client to bypass RLS — we must share with ALL participants
    // regardless of hierarchy visibility rules. The uploader intentionally
    // chose to share this file, so RLS filtering would silently exclude people.
    const admin = createAdminClient()
    let userIds: string[] = []

    if (taskId) {
        const { data } = await admin
            .from('task_assignees')
            .select('user_id')
            .eq('task_id', taskId)
        userIds = (data ?? []).map((r: { user_id: string }) => r.user_id)
    } else if (messageId) {
        const { data: msg } = await admin
            .from('messages')
            .select('conversation_id')
            .eq('id', messageId)
            .single()

        if (msg?.conversation_id) {
            const { data } = await admin
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', msg.conversation_id)
            userIds = (data ?? []).map((r: { user_id: string }) => r.user_id)
        }
    }

    const otherIds = userIds.filter(id => id !== uploaderId)
    if (!otherIds.length) return []

    const { data: users } = await admin
        .from('users')
        .select('email')
        .in('id', otherIds)

    return (users ?? []).map((u: { email: string }) => u.email).filter(Boolean)
}

async function shareFileWithParticipants(
    accessToken: string,
    fileId: string,
    emails: string[],
): Promise<void> {
    // Share in parallel — failures are non-fatal (user may not have a Google account)
    await Promise.allSettled(
        emails.map(email =>
            fetch(`${DRIVE_FILES_API}/${fileId}/permissions`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'user',
                    emailAddress: email,
                }),
            })
        )
    )
}
