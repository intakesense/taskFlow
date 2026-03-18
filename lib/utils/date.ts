// Date utilities using date-fns
import { format, formatDistanceToNow, formatDistance, isToday, isYesterday } from 'date-fns'

/**
 * Format a date string to a short format (e.g., "Jan 19")
 */
export function formatDateShort(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return format(date, 'MMM d')
}

/**
 * Format a date string to include time (e.g., "Jan 19, 2:30 PM")
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return format(date, 'MMM d, h:mm a')
}

/**
 * Format a date string for full display (e.g., "January 19, 2026")
 */
export function formatDateFull(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return format(date, 'MMMM d, yyyy')
}

/**
 * Format a message timestamp
 * - Today: "2:30 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Monday"
 * - Older: "Jan 19"
 */
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)

  if (isToday(date)) {
    return format(date, 'h:mm a')
  }

  if (isYesterday(date)) {
    return 'Yesterday'
  }

  const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff < 7) {
    return format(date, 'EEEE') // Day name (e.g., "Monday")
  }

  return format(date, 'MMM d')
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelative(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return formatDistanceToNow(date, { addSuffix: true })
}

/**
 * Format duration between two dates
 */
export function formatDuration(startDate: string, endDate: string): string {
  return formatDistance(new Date(startDate), new Date(endDate))
}

/**
 * Check if a deadline is overdue
 */
export function isOverdue(deadlineString: string | null): boolean {
  if (!deadlineString) return false
  return new Date(deadlineString) < new Date()
}

/**
 * Check if a deadline is approaching (within 24 hours)
 */
export function isApproaching(deadlineString: string | null): boolean {
  if (!deadlineString) return false
  const deadline = new Date(deadlineString)
  const now = new Date()
  const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hoursUntil > 0 && hoursUntil <= 24
}

/**
 * Format a compact duration for status time display
 * Examples: "now", "5m", "2h", "3d", "2w"
 */
export function formatCompactDuration(dateString: string | null): string {
  if (!dateString) return ''

  const ms = Date.now() - new Date(dateString).getTime()
  if (ms < 0) return '' // Future date, shouldn't happen

  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (weeks > 0) return `${weeks}w`
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return 'now'
}

/**
 * Get the duration in milliseconds from a date string
 * Used for threshold comparisons (e.g., warning colors)
 */
export function getDurationMs(dateString: string | null): number {
  if (!dateString) return 0
  return Date.now() - new Date(dateString).getTime()
}

// Duration thresholds for warning colors (in milliseconds)
export const DURATION_THRESHOLDS = {
  IN_PROGRESS_WARNING: 3 * 24 * 60 * 60 * 1000, // 3 days
  ON_HOLD_WARNING: 1 * 24 * 60 * 60 * 1000,     // 1 day
}

/**
 * Format date for progress timeline header (e.g., "MON 5 MAR")
 */
export function formatProgressDate(dateString: string): string {
  const date = new Date(dateString)
  return format(date, 'EEE d MMM').toUpperCase()
}

/**
 * Format time for progress entry (e.g., "13:10")
 */
export function formatProgressTime(dateString: string): string {
  const date = new Date(dateString)
  return format(date, 'HH:mm')
}

/**
 * Get ISO date string (YYYY-MM-DD) for grouping progress updates by date
 */
export function getDateKey(dateString: string): string {
  const date = new Date(dateString)
  return format(date, 'yyyy-MM-dd')
}
