import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@taskflow/core';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// Supabase OAuth redirect URL (uses custom scheme)
const REDIRECT_URL = 'taskflow://auth/callback';

// Check if running in Tauri
const isTauri = () => '__TAURI_INTERNALS__' in window;

// Track if we're handling a callback to prevent duplicate processing
const CALLBACK_LOCK_KEY = 'taskflow_oauth_processing';

function tryAcquireCallbackLock(): boolean {
  try {
    const lock = localStorage.getItem(CALLBACK_LOCK_KEY);
    const now = Date.now();
    if (lock && now - parseInt(lock) < 5000) {
      return false;
    }
    localStorage.setItem(CALLBACK_LOCK_KEY, now.toString());
    return true;
  } catch {
    return true;
  }
}

function releaseCallbackLock(): void {
  try {
    localStorage.removeItem(CALLBACK_LOCK_KEY);
  } catch {}
}

interface AuthState {
  user: SupabaseUser | null;
  profile: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Track initialization outside of store to prevent duplicate setup
let authInitialized = false;
let deepLinkInitialized = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    if (authInitialized) {
      return;
    }
    authInitialized = true;

    // Helper to update state (captures set in closure)
    const updateState = (newState: Partial<AuthState>) => set(newState);

    try {
      // Set up auth state listener
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          updateState({ user: null, session: null, profile: null, loading: false });
          return;
        }

        if (session?.user) {
          // Update immediately with user, fetch profile separately
          updateState({
            user: session.user,
            session,
            loading: false,
            initialized: true,
          });

          // Fetch profile outside the callback using setTimeout to break the sync chain
          setTimeout(async () => {
            try {
              const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (profile) {
                updateState({ profile: profile as User | null });
              }
            } catch {
              // Profile fetch failed silently
            }
          }, 0);
        } else if (event === 'INITIAL_SESSION') {
          updateState({ loading: false, initialized: true });
        }
      });

      // Set up deep link listener for OAuth callback
      if (isTauri() && !deepLinkInitialized) {
        deepLinkInitialized = true;
        try {
          const { listen } = await import('@tauri-apps/api/event');
          await listen<string>('auth-callback', async (event) => {
            const url = typeof event.payload === 'string'
              ? event.payload
              : String(event.payload);

            if (!tryAcquireCallbackLock()) return;

            try {
              const hashPart = url.split('#')[1];
              if (!hashPart) {
                releaseCallbackLock();
                return;
              }

              const hashParams = new URLSearchParams(hashPart);
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');

              if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (error) {
                  console.error('OAuth session error:', error);
                  releaseCallbackLock();
                  return;
                }

                setTimeout(() => window.location.reload(), 200);
              } else {
                releaseCallbackLock();
              }
            } catch (e) {
              console.error('OAuth callback error:', e);
              releaseCallbackLock();
            }
          });
        } catch {
          // Deep link not available
        }
      }

      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        updateState({
          user: session.user,
          session,
          profile: profile as User | null,
          loading: false,
          initialized: true,
        });
      } else {
        updateState({ loading: false, initialized: true });
      }
    } catch {
      updateState({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error };

    if (data.session?.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      set({
        user: data.session.user,
        session: data.session,
        profile: profile as User | null,
        loading: false,
        initialized: true,
      });
    }

    return { error: null };
  },

  signInWithGoogle: async () => {
    try {
      // Clear any stale lock
      releaseCallbackLock();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error: error as Error };

      if (data.url && isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_oauth_url', { url: data.url });
      }

      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    set({ profile: profile as User | null });
  },
}));
