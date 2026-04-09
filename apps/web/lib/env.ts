// Environment variables - validated at build time in next.config.ts
// This file provides type-safe access to client-side env vars

export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
} as const;
