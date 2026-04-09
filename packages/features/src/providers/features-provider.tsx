'use client';

import { type ReactNode, type ComponentType } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';
import { NavigationProvider, type NavigateOptions, type LinkProps } from './navigation-context';
import { ServicesProvider } from './services-context';
import { AuthProvider, type AuthContextValue } from './auth-context';
import { ImageProvider, type ImageProps } from './image-context';

export interface FeaturesProviderProps {
  children: ReactNode;

  /** Navigation configuration */
  navigation: {
    currentPath: string;
    navigate: (path: string, options?: NavigateOptions) => void;
    goBack: () => void;
    Link: ComponentType<LinkProps>;
  };

  /** Supabase client for data operations */
  supabase: SupabaseClient<Database>;

  /** Auth context value (from your app's auth implementation) */
  auth: AuthContextValue;

  /** Optional: Optimized image component (Next.js Image) */
  Image?: ComponentType<ImageProps>;
}

/**
 * Combined provider for all @taskflow/features contexts.
 *
 * @example
 * ```tsx
 * // Web app
 * <FeaturesProvider
 *   navigation={{
 *     currentPath: pathname,
 *     navigate: (path) => router.push(path),
 *     goBack: () => router.back(),
 *     Link: NextLink,
 *   }}
 *   supabase={supabase}
 *   auth={authValue}
 *   Image={NextImage}
 * >
 *   <App />
 * </FeaturesProvider>
 *
 * // Desktop app
 * <FeaturesProvider
 *   navigation={{
 *     currentPath: '/' + currentPage,
 *     navigate: setCurrentPage,
 *     goBack: () => {},
 *     Link: DesktopLink,
 *   }}
 *   supabase={supabase}
 *   auth={authValue}
 * >
 *   <App />
 * </FeaturesProvider>
 * ```
 */
export function FeaturesProvider({
  children,
  navigation,
  supabase,
  auth,
  Image,
}: FeaturesProviderProps) {
  return (
    <NavigationProvider
      currentPath={navigation.currentPath}
      navigate={navigation.navigate}
      goBack={navigation.goBack}
      Link={navigation.Link}
    >
      <ServicesProvider supabase={supabase}>
        <AuthProvider value={auth}>
          <ImageProvider Image={Image}>
            {children}
          </ImageProvider>
        </AuthProvider>
      </ServicesProvider>
    </NavigationProvider>
  );
}
