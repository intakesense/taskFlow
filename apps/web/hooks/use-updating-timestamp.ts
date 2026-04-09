import { useState, useEffect, useRef } from 'react'
import { formatMessageTime, formatRelative } from '@/lib/utils/date'

/**
 * useUpdatingTimestamp - Hook for reactive timestamp updates
 *
 * Automatically updates timestamp display at intelligent intervals:
 * - Every 1 minute for recent messages (< 1 hour old)
 * - Every 15 minutes for messages < 24 hours old
 * - Every hour for older messages
 *
 * @param dateString - ISO date string to format
 * @param formatType - 'message' for chat timestamps or 'relative' for "X ago"
 * @returns Formatted timestamp that updates automatically
 */
export function useUpdatingTimestamp(
  dateString: string | null | undefined,
  formatType: 'message' | 'relative' = 'message'
): string {
  const [timestamp, setTimestamp] = useState<string>(() => {
    if (!dateString) return ''
    return formatType === 'message' ? formatMessageTime(dateString) : formatRelative(dateString)
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Handle empty dateString via cleanup - avoid direct setState in effect body
    if (!dateString) {
      return
    }

    // Calculate age of message in milliseconds
    const getMessageAge = () => {
      return Date.now() - new Date(dateString).getTime()
    }

    // Determine update interval based on message age
    const getUpdateInterval = (): number => {
      const age = getMessageAge()
      const MINUTE = 60 * 1000
      const HOUR = 60 * MINUTE
      const DAY = 24 * HOUR

      if (age < HOUR) {
        return MINUTE // Update every minute for recent messages
      } else if (age < DAY) {
        return 15 * MINUTE // Update every 15 minutes for < 24h old
      } else {
        return HOUR // Update every hour for older messages
      }
    }

    // Update the timestamp - this is in an interval callback, not direct effect body
    const updateTimestamp = () => {
      const formatted =
        formatType === 'message' ? formatMessageTime(dateString) : formatRelative(dateString)
      setTimestamp(formatted)
    }

    // Schedule initial update via microtask to avoid direct setState in effect body
    queueMicrotask(updateTimestamp)

    // Set up interval with intelligent timing
    const interval = getUpdateInterval()
    intervalRef.current = setInterval(updateTimestamp, interval)

    // Cleanup on unmount or date change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [dateString, formatType])

  return timestamp
}

/**
 * useUpdatingRelativeTime - Convenience hook for "X ago" format
 *
 * Automatically updates relative time display (e.g., "2 minutes ago")
 *
 * @param dateString - ISO date string to format
 * @returns Relative time string that updates automatically
 */
export function useUpdatingRelativeTime(dateString: string | null | undefined): string {
  return useUpdatingTimestamp(dateString, 'relative')
}
