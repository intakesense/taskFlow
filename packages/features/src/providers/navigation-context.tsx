'use client';

import { createContext, useContext, type ReactNode, type ComponentType, type MouseEvent } from 'react';

// Link component props - compatible with Next.js Link and custom implementations
export interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

export interface NavigateOptions {
  replace?: boolean;
}

export interface NavigationContextValue {
  /** Current path (e.g., "/tasks", "/messages") */
  currentPath: string;

  /** Navigate to a new path */
  navigate: (path: string, options?: NavigateOptions) => void;

  /** Go back in history */
  goBack: () => void;

  /** Link component for declarative navigation */
  Link: ComponentType<LinkProps>;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
  children: ReactNode;
  currentPath: string;
  navigate: (path: string, options?: NavigateOptions) => void;
  goBack: () => void;
  Link: ComponentType<LinkProps>;
}

/**
 * Provides navigation capabilities to feature components.
 *
 * Web apps: Pass Next.js Link, useRouter, usePathname
 * Desktop apps: Pass custom Link component and state-based navigation
 */
export function NavigationProvider({
  children,
  currentPath,
  navigate,
  goBack,
  Link,
}: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={{ currentPath, navigate, goBack, Link }}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Hook to access navigation context.
 *
 * @example
 * ```tsx
 * const { navigate, currentPath, Link } = useNavigation();
 *
 * // Imperative navigation
 * navigate('/tasks');
 *
 * // Check current route
 * const isActive = currentPath === '/tasks';
 *
 * // Declarative navigation
 * <Link href="/tasks">Tasks</Link>
 * ```
 */
export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

/**
 * Check if navigation context is available.
 * Useful for components that can work with or without navigation.
 */
export function useNavigationOptional(): NavigationContextValue | null {
  return useContext(NavigationContext);
}
