import { useAuthStore } from '@/stores/auth';
import type { AuthContextValue } from '@taskflow/features';

/**
 * Creates an auth context value from the Zustand auth store.
 * This adapter allows the desktop app to use @taskflow/features
 * with its Zustand-based auth implementation.
 */
export function useAuthValue(): AuthContextValue {
  const store = useAuthStore();

  return {
    user: store.user,
    profile: store.profile,
    loading: store.loading,
    effectiveUser: store.profile, // No masking in desktop for now
    maskedAsUser: null,
    signIn: store.signIn,
    signOut: store.signOut,
    refreshProfile: store.refreshProfile,
    maskAs: async () => {}, // No-op for desktop
  };
}
