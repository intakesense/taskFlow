// Web (Next.js) Supabase client
import { createBrowserClient as createBrowserClientSSR, createServerClient as createServerClientSSR } from '@supabase/ssr';
import type { Database } from '@taskflow/core/types/database';

// Environment variables (expected to be set in the web app)
const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return url;
};

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  return key;
};

// Browser client (singleton pattern)
let browserClient: ReturnType<typeof createBrowserClientSSR<Database>> | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClientSSR<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      realtime: {
        // Offload heartbeats to a Web Worker so the browser's background-tab
        // throttling (which delays setTimeout > 1min) doesn't starve heartbeats
        // and cause TIMED_OUT disconnects when the app is idle.
        worker: true,
      },
    }
  );

  return browserClient;
}

// Server client (requires cookie handlers from Next.js)
export function createServerClient(
  cookieStore: {
    get: (name: string) => { value: string } | undefined;
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
    delete: (name: string) => void;
  }
) {
  return createServerClientSSR<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
}

// Re-export types
export type { Database };
