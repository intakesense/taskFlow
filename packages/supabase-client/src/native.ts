// Native (React Native / Expo) Supabase client
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core/types/database';

// Storage adapter interface (to be implemented by expo-secure-store or similar)
export interface SecureStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Singleton client instance
let nativeClient: SupabaseClient<Database> | null = null;

/**
 * Create a Supabase client for React Native / Expo
 *
 * @param url - Supabase project URL
 * @param anonKey - Supabase anonymous key
 * @param storage - Secure storage adapter (e.g., expo-secure-store)
 *
 * Usage with expo-secure-store:
 * ```typescript
 * import * as SecureStore from 'expo-secure-store';
 *
 * const storage = {
 *   getItem: SecureStore.getItemAsync,
 *   setItem: SecureStore.setItemAsync,
 *   removeItem: SecureStore.deleteItemAsync,
 * };
 *
 * const supabase = createNativeClient(SUPABASE_URL, SUPABASE_ANON_KEY, storage);
 * ```
 */
export function createNativeClient(
  url: string,
  anonKey: string,
  storage: SecureStorageAdapter
): SupabaseClient<Database> {
  if (nativeClient) return nativeClient;

  nativeClient = createClient<Database>(url, anonKey, {
    auth: {
      storage: {
        getItem: storage.getItem,
        setItem: storage.setItem,
        removeItem: storage.removeItem,
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disable for mobile
    },
  });

  return nativeClient;
}

/**
 * Get the existing native client (throws if not initialized)
 */
export function getNativeClient(): SupabaseClient<Database> {
  if (!nativeClient) {
    throw new Error(
      'Supabase client not initialized. Call createNativeClient() first.'
    );
  }
  return nativeClient;
}

/**
 * Reset the client (useful for sign out)
 */
export function resetNativeClient(): void {
  nativeClient = null;
}

// Re-export types
export type { Database, SupabaseClient };
