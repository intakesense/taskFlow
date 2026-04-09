'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '@taskflow/core';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthContextValue {
  /** Supabase auth user */
  user: SupabaseUser | null;

  /** User profile from database */
  profile: User | null;

  /** Loading state during auth initialization */
  loading: boolean;

  /** Effective user (supports admin masking on web) */
  effectiveUser: User | null;

  /** If admin is viewing as another user */
  maskedAsUser: User | null;

  /** Sign in with email/password */
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;

  /** Sign out */
  signOut: () => Promise<void>;

  /** Refresh user profile from database */
  refreshProfile: () => Promise<void>;

  /** Admin: view app as another user */
  maskAs: (userId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  value: AuthContextValue;
}

/**
 * Provides auth state to feature components.
 *
 * Each platform implements its own auth logic and passes
 * the value to this provider.
 *
 * @example
 * ```tsx
 * // Web app with Context-based auth
 * const authValue = useWebAuth(); // your existing hook
 * <AuthProvider value={authValue}>{children}</AuthProvider>
 *
 * // Desktop app with Zustand store
 * const authValue = useDesktopAuth(); // adapter over Zustand
 * <AuthProvider value={authValue}>{children}</AuthProvider>
 * ```
 */
export function AuthProvider({ children, value }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state and methods.
 *
 * @example
 * ```tsx
 * const { user, profile, effectiveUser, signOut } = useAuth();
 *
 * // Check if user is admin
 * if (effectiveUser?.is_admin) { ... }
 *
 * // Get display name
 * const name = effectiveUser?.name ?? 'Guest';
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Check if auth context is available.
 */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
