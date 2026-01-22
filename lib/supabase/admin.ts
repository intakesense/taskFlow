import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase admin client using the service role key.
 * 
 * IMPORTANT: This client bypasses Row Level Security (RLS) and should
 * ONLY be used in server-side code (API routes, server actions, etc.).
 * Never expose this client or the service role key to the browser.
 * 
 * Use cases:
 * - Admin operations that need to bypass RLS
 * - Background jobs and cron tasks
 * - Server-side data migrations
 * 
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not set
 * @see https://supabase.com/docs/guides/api/api-keys#service_role-key
 */
export const createAdminClient = () => {
    if (!supabaseServiceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not set. " +
            "This is required for admin operations. " +
            "Get it from: Supabase Dashboard → Project Settings → API"
        );
    }

    return createSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            // Don't persist sessions for admin client
            persistSession: false,
            // Auto-refresh is not needed for service role
            autoRefreshToken: false,
            // Detect session in URL is not needed for service role
            detectSessionInUrl: false,
        },
    });
};
