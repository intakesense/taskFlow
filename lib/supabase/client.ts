import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

/**
 * Creates a Supabase browser client without singleton pattern.
 * This ensures fresh auth state on every page load and prevents stale cache issues.
 *
 * Note: Supabase JS SDK v2 internally handles client reuse and session management,
 * so we don't need our own singleton pattern. Creating multiple instances is safe.
 */
export const createClient = () => {
    return createBrowserClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
            // Auto-refresh tokens before they expire
            autoRefreshToken: true,
            // Persist session in localStorage
            persistSession: true,
            // Detect auth callbacks in URL (for OAuth, magic links, etc.)
            detectSessionInUrl: true,
            // Use PKCE flow for enhanced security
            flowType: 'pkce',
            // Custom storage implementation that always reads fresh values
            storage: {
                getItem: (key: string) => {
                    if (typeof window === 'undefined') return null
                    return localStorage.getItem(key)
                },
                setItem: (key: string, value: string) => {
                    if (typeof window === 'undefined') return
                    localStorage.setItem(key, value)
                },
                removeItem: (key: string) => {
                    if (typeof window === 'undefined') return
                    localStorage.removeItem(key)
                }
            }
        },
        global: {
            headers: {
                'x-client-info': 'taskflow-web',
            },
        },
    });
};
