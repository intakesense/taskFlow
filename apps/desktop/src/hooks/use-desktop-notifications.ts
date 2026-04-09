/**
 * useDesktopNotifications Hook
 *
 * Manages the lifecycle of desktop notifications.
 * Automatically subscribes when user logs in and unsubscribes on logout.
 */

import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core/types/database';
import {
  DesktopNotificationManager,
  initializeDesktopNotifications,
  cleanupDesktopNotifications,
  setNotificationNavigationCallback,
  initializeNotificationClickHandler,
} from '@/lib/desktop-notifications';

interface UseDesktopNotificationsOptions {
  supabase: SupabaseClient<Database>;
  userId: string | null | undefined;
  enabled?: boolean;
  onNavigate?: (path: string) => void;
}

/**
 * Hook to manage desktop notification subscriptions
 *
 * @param options.supabase - Supabase client instance
 * @param options.userId - Current user's ID (null if not logged in)
 * @param options.enabled - Whether notifications should be enabled (default: true)
 * @param options.onNavigate - Callback for navigating when notification is clicked
 */
export function useDesktopNotifications({
  supabase,
  userId,
  enabled = true,
  onNavigate,
}: UseDesktopNotificationsOptions): void {
  const managerRef = useRef<DesktopNotificationManager | null>(null);
  const clickHandlerInitialized = useRef(false);

  // Set up navigation callback
  useEffect(() => {
    if (onNavigate) {
      setNotificationNavigationCallback(onNavigate);
    }
  }, [onNavigate]);

  // Initialize notification click handler (only once)
  useEffect(() => {
    if (!window.__TAURI_INTERNALS__ || clickHandlerInitialized.current) return;

    clickHandlerInitialized.current = true;
    initializeNotificationClickHandler();
  }, []);

  useEffect(() => {
    // Only initialize if we have a user ID and notifications are enabled
    if (!userId || !enabled) {
      // Clean up if user logged out or notifications disabled
      if (managerRef.current) {
        cleanupDesktopNotifications();
        managerRef.current = null;
      }
      return;
    }

    // Check if running in Tauri
    if (!window.__TAURI_INTERNALS__) {
      console.log('[DesktopNotifications] Not running in Tauri, skipping initialization');
      return;
    }

    // Initialize notifications
    console.log('[DesktopNotifications] Initializing for user:', userId);
    managerRef.current = initializeDesktopNotifications(supabase, userId);

    // Cleanup on unmount or user change
    return () => {
      cleanupDesktopNotifications();
      managerRef.current = null;
    };
  }, [supabase, userId, enabled]);
}

// Type declaration for Tauri globals
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
