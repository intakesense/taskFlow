/**
 * GET /api/google/picker-token
 * Returns a valid Google access token for the Drive Picker.
 * Token is refreshed server-side if expired — client never stores it persistently.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAccessToken } from '@/lib/google/tokens'
import { cookies } from 'next/headers'

export async function GET() {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const accessToken = await getGoogleAccessToken(user.id)
        return NextResponse.json({ accessToken })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.startsWith('NO_GOOGLE_TOKEN') || message.startsWith('NO_REFRESH_TOKEN') || message.startsWith('REFRESH_FAILED')) {
            return NextResponse.json({ error: message, code: 'NO_TOKEN' }, { status: 403 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
