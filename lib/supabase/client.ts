import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

/**
 * Creates a Supabase browser client for client-side operations.
 *
 * Note: createBrowserClient already uses a singleton pattern internally,
 * so you only ever create one instance, no matter how many times you call this function.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/creating-a-client
 */
export const createClient = () => {
    return createBrowserClient<Database>(supabaseUrl, supabaseKey);
};
