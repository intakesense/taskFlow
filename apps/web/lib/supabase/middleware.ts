import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const updateSession = async (request: NextRequest) => {
    // Create an unmodified response
    let supabaseResponse = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient<Database>(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        },
    );

    // Validate JWT and refresh session if needed
    // getClaims() validates the JWT signature against the project's JWKS endpoint
    // This is faster than getUser() as it doesn't require a network request for each call
    // (when using asymmetric JWT signing keys)
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

    // Extract user from claims - the 'sub' claim contains the user ID
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub as string } : null

    // If there's an error (e.g., no session), user will be null
    if (claimsError) {
        // Session expired or invalid - user will be redirected to login for protected routes
    }

    // Check if this is a prefetch request (Next.js Link hover prefetching)
    // Prefetch requests happen before auth cookies are fully processed, so we skip auth checks
    const isPrefetch = request.headers.get('x-middleware-prefetch') === '1' ||
        request.headers.get('purpose') === 'prefetch' ||
        request.headers.get('x-nextjs-data') !== null

    // Public routes that don't require authentication
    const publicRoutes = ['/login']
    const isPublicRoute = publicRoutes.some(route =>
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith('/api/auth')
    )

    // Skip auth redirect for API routes - they handle their own auth and CORS
    // This allows preflight OPTIONS requests to reach the handlers
    const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

    // Redirect to login if not authenticated and trying to access protected route
    // Skip redirect for prefetch requests to avoid false redirects
    // Skip redirect for API routes - they handle their own auth
    if (!user && !isPublicRoute && !isPrefetch && !isApiRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Redirect to root (Tasks) if authenticated and trying to access login
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
};
