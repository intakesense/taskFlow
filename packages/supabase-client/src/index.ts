// @taskflow/supabase-client - Platform-agnostic Supabase client factory

export type { SupabaseClient } from '@supabase/supabase-js';
export type { Database } from '@taskflow/core/types/database';

// Re-export platform-specific clients
// Usage:
//   Web (Next.js): import { createBrowserClient, createServerClient } from '@taskflow/supabase-client/web'
//   Native (Expo): import { createNativeClient } from '@taskflow/supabase-client/native'
