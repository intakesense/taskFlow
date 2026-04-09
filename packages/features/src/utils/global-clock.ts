'use client';

/**
 * Global Clock - Single interval for ALL timestamp updates
 *
 * Instead of each message creating its own setInterval (N messages = N intervals),
 * this provides a single global clock that all timestamps subscribe to.
 *
 * Result: 50 messages = 1 interval = 50 cheap recomputes instead of 50 separate timers
 */

import { useSyncExternalStore } from 'react';
import { formatMessageTime, formatRelative } from './date';

class GlobalClock {
  private listeners = new Set<() => void>();
  private currentTime = Date.now();

  constructor() {
    // Only start interval in browser environment
    if (typeof window !== 'undefined') {
      // Single interval for the entire app - updates every minute
      // Intentionally not stored - singleton runs for entire app lifetime
      setInterval(() => {
        this.currentTime = Date.now();
        // Notify all subscribers
        this.listeners.forEach((listener) => listener());
      }, 60_000); // 60 seconds
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): number => {
    return this.currentTime;
  };

  // For SSR - return current time
  getServerSnapshot = (): number => {
    return Date.now();
  };
}

// Singleton instance - lazily created to support SSR
let globalClock: GlobalClock | null = null;

function getGlobalClock(): GlobalClock {
  if (!globalClock) {
    globalClock = new GlobalClock();
  }
  return globalClock;
}

/**
 * useGlobalTime - Subscribe to the global clock
 *
 * All components using this hook share a single interval.
 * Returns the current time in milliseconds.
 */
export function useGlobalTime(): number {
  const clock = getGlobalClock();
  return useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot
  );
}

/**
 * useFormattedTimestamp - Get a formatted timestamp that updates automatically
 *
 * React Compiler handles memoization automatically, so we removed useMemo.
 * The computation is cheap and will be optimized by the compiler.
 *
 * @param dateString - ISO date string to format
 * @param formatType - 'message' for chat timestamps or 'relative' for "X ago"
 * @returns Formatted timestamp string that updates with the global clock
 */
export function useFormattedTimestamp(
  dateString: string | null | undefined,
  formatType: 'message' | 'relative' = 'message'
): string {
  // Subscribe to global clock for automatic updates
  useGlobalTime();

  // React Compiler will optimize this - no manual useMemo needed
  if (!dateString) return '';
  return formatType === 'message'
    ? formatMessageTime(dateString)
    : formatRelative(dateString);
}

/**
 * useFormattedRelativeTime - Convenience hook for "X ago" format
 *
 * @param dateString - ISO date string to format
 * @returns Relative time string (e.g., "2 minutes ago") that updates automatically
 */
export function useFormattedRelativeTime(
  dateString: string | null | undefined
): string {
  return useFormattedTimestamp(dateString, 'relative');
}
