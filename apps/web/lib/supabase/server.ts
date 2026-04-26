import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
    return createServerClient<Database>(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        },
    );
};

/**
 * Creates a Supabase client from a Next.js API request.
 * Accepts either:
 *   - Cookie-based sessions (web browser)
 *   - Authorization: Bearer <access_token> (desktop / external clients)
 *
 * Usage in API routes:
 *   const { supabase, user, error } = await createClientFromRequest(request);
 *   if (error) return NextResponse.json({ error }, { status: 401 });
 */
export async function createClientFromRequest(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearerToken) {
        // Desktop path: use a plain JS client with the access token
        const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${bearerToken}` } },
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return { supabase, user: null, error: 'Unauthorized' as const };
        return { supabase, user, error: null };
    }

    // Web path: cookie-based session
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { supabase, user: null, error: 'Unauthorized' as const };
    return { supabase, user, error: null };
}
