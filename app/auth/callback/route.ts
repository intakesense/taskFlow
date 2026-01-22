import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    // The 'next' parameter can be used to redirect to a specific page after auth
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)

        // Exchange the auth code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
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
    }

    // If there's no code or an error occurred, redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
