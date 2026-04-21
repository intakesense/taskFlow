import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

/**
 * Auth callback route handler for OAuth and magic link flows.
 * 
 * This route handles the redirect from Supabase Auth after:
 * - OAuth provider authentication (Google, GitHub, etc.)
 * - Magic link email verification
 * - Password reset confirmation
 * 
 * The 'code' query parameter contains the auth code that needs to be
 * exchanged for a session using the PKCE flow.
 * 
 * @see https://supabase.com/docs/guides/auth/sessions/pkce-flow
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // Validate 'next' to prevent open redirect — must be a relative path
    const rawNext = searchParams.get('next') ?? '/'
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

    if (code) {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)

        // Exchange the auth code for a session
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth callback error:', error.message)
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
        }

        // Store Google tokens if this was a Google OAuth sign-in
        const session = sessionData?.session
        // provider_token presence is sufficient — it's only issued for OAuth providers
        if (session?.provider_token && session.user) {
            try {
                const admin = createAdminClient()
                const { error: upsertError } = await admin.from('user_google_tokens').upsert({
                    user_id: session.user.id,
                    access_token: session.provider_token,
                    refresh_token: session.provider_refresh_token ?? null,
                    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                    scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file',
                }, { onConflict: 'user_id' })

                if (upsertError) {
                    console.error('[auth/callback] Failed to store Google tokens:', upsertError.message)
                }
            } catch (e) {
                console.error('[auth/callback] Exception storing Google tokens:', e)
            }
        }

        // Successful authentication - redirect to the intended destination
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'

        if (isLocalEnv) {
            // Use localhost for development
            return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
            // Use forwarded host for production behind proxy/load balancer
            return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // If there's no code, redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=no_code_provided`)
}
