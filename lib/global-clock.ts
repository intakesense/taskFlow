/**
 * Global Clock - Single interval for ALL timestamp updates
 * 
 * Instead of each message creating its own setInterval (N messages = N intervals),
 * this provides a single global clock that all timestamps subscribe to.
 * 
 * Result: 50 messages = 1 interval = 50 cheap recomputes instead of 50 separate timers
 */

import { useSyncExternalStore, useMemo } from 'react'
import { formatMessageTime, formatRelative } from '@/lib/utils/date'

class GlobalClock {
    private listeners = new Set<() => void>()
    private currentTime = Date.now()
    private intervalId: NodeJS.Timeout | null = null

    constructor() {
        // Single interval for the entire app - updates every minute
        this.intervalId = setInterval(() => {
            this.currentTime = Date.now()
            // Notify all subscribers
            this.listeners.forEach(listener => listener())
        }, 60_000) // 60 seconds
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    getSnapshot = (): number => {
        return this.currentTime
    }

    // For SSR - return current time
    getServerSnapshot = (): number => {
        return Date.now()
    }
}

// Singleton instance
const globalClock = new GlobalClock()

/**
 * useGlobalTime - Subscribe to the global clock
 * 
 * All components using this hook share a single interval.
 * Returns the current time in milliseconds.
 */
export function useGlobalTime(): number {
    return useSyncExternalStore(
        globalClock.subscribe,
        globalClock.getSnapshot,
        globalClock.getServerSnapshot
    )
}

/**
 * useFormattedTimestamp - Get a formatted timestamp that updates automatically
 * 
 * @param dateString - ISO date string to format
 * @param formatType - 'message' for chat timestamps or 'relative' for "X ago"
 * @returns Formatted timestamp string that updates with the global clock
 */
export function useFormattedTimestamp(
    dateString: string | null | undefined,
    formatType: 'message' | 'relative' = 'message'
): string {
    const now = useGlobalTime()

    return useMemo(() => {
        if (!dateString) return ''
        return formatType === 'message'
            ? formatMessageTime(dateString)
            : formatRelative(dateString)
    }, [dateString, formatType, now]) // Recomputes when global clock ticks
}

/**
 * useFormattedRelativeTime - Convenience hook for "X ago" format
 * 
 * @param dateString - ISO date string to format
 * @returns Relative time string (e.g., "2 minutes ago") that updates automatically
 */
export function useFormattedRelativeTime(dateString: string | null | undefined): string {
    return useFormattedTimestamp(dateString, 'relative')
}
