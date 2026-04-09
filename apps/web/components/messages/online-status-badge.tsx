import { cn } from '@/lib/utils'

interface OnlineStatusBadgeProps {
  isOnline: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showOffline?: boolean
}

/**
 * OnlineStatusBadge - Visual indicator for user online status
 *
 * Displays a colored badge (dot) showing whether a user is online or offline:
 * - Green: User is online and active
 * - Gray: User is offline (only shown if showOffline is true)
 *
 * Typically positioned absolutely over an avatar component.
 *
 * @param isOnline - Whether the user is currently online
 * @param size - Size variant of the badge ('sm' | 'md' | 'lg')
 * @param className - Additional CSS classes
 * @param showOffline - Whether to show gray badge when offline (default: false)
 */
export function OnlineStatusBadge({
  isOnline,
  size = 'md',
  className,
  showOffline = false,
}: OnlineStatusBadgeProps) {
  // Don't render anything if offline and showOffline is false
  if (!isOnline && !showOffline) return null

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <span
      className={cn(
        'rounded-full border-2 border-background',
        sizeClasses[size],
        isOnline ? 'bg-green-500' : 'bg-gray-400',
        className
      )}
      aria-label={isOnline ? 'Online' : 'Offline'}
      role="status"
    />
  )
}

/**
 * OnlineStatusDot - Inline dot indicator for online status
 *
 * Similar to OnlineStatusBadge but designed for inline use (not positioned absolutely).
 * Useful for showing online status in lists or text.
 */
export function OnlineStatusDot({ isOnline, size = 'sm' }: OnlineStatusBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        sizeClasses[size],
        isOnline ? 'bg-green-500' : 'bg-gray-400'
      )}
      aria-label={isOnline ? 'Online' : 'Offline'}
      role="status"
    />
  )
}
