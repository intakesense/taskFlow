/**
 * Server-side Google token management.
 * Used by Calendar and Drive API routes to get a valid access token for a user.
 * Never import this in client components — server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleTokenRow {
    access_token: string
    refresh_token: string | null
    expires_at: string
    scopes: string
}

// Google can return a new refresh_token when rotating credentials
interface RefreshResponse {
    access_token: string
    expires_in: number
    refresh_token?: string  // present when Google rotates the token
}

/**
 * Returns a valid Google access token for the given user.
 * Automatically refreshes if expired (with 60s buffer) and persists
 * any rotated refresh_token Google returns during the refresh.
 * Throws if no token exists or refresh fails.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
    const admin = createAdminClient()

    const { data, error } = await admin
        .from('user_google_tokens')
        .select('access_token, refresh_token, expires_at, scopes')
        .eq('user_id', userId)
        .single()

    if (error || !data) {
        throw new Error('NO_GOOGLE_TOKEN: User has not connected Google account')
    }

    const row = data as GoogleTokenRow
    const expiresAt = new Date(row.expires_at).getTime()
    const nowWithBuffer = Date.now() + 60 * 1000

    if (expiresAt > nowWithBuffer) {
        return row.access_token
    }

    if (!row.refresh_token) {
        throw new Error('NO_REFRESH_TOKEN: User must re-authenticate with Google')
    }

    const refreshed = await refreshGoogleToken(row.refresh_token)

    // Persist new access token — and rotated refresh_token if Google issued one
    await admin.from('user_google_tokens').update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        // Only update refresh_token if Google returned a new one (#12 fix)
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
    }).eq('user_id', userId)

    return refreshed.access_token
}

/**
 * Checks whether a user has connected their Google account.
 */
export async function hasGoogleToken(userId: string): Promise<boolean> {
    const admin = createAdminClient()
    const { data } = await admin
        .from('user_google_tokens')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
    return !!data
}

async function refreshGoogleToken(refreshToken: string): Promise<RefreshResponse> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            // NEXT_PUBLIC_ prefix here is intentional: client_id is not secret.
            // The client_secret below is kept server-only (no NEXT_PUBLIC_ prefix).
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    })

    if (!res.ok) {
        // Don't expose Google's error body — log server-side only
        console.error('Google token refresh failed:', res.status)
        throw new Error('REFRESH_FAILED: Google token refresh failed')
    }

    return res.json()
}
