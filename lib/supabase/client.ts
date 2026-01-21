import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// Singleton instance to prevent multiple client creation and ensure consistent auth state
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export const createClient = () => {
    // Return existing instance if available
    if (supabaseInstance) {
        return supabaseInstance;
    }

    // Create new instance with proper storage and auth configuration
    supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
            // Force session refresh on initialization to handle stale cache
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            // Use PKCE flow for better cache handling and security
            flowType: 'pkce',
        },
        global: {
            headers: {
                'x-client-info': 'taskflow-web',
            },
        },
    });

    return supabaseInstance;
};

// Reset client instance - call this on logout or when session becomes invalid
export const resetClient = () => {
    supabaseInstance = null;
};
