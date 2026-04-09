'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseIdleDetectionOptions {
  /** Time in ms before showing warning (default: 10 minutes) */
  idleTimeout?: number
  /** Time in ms user has to respond before disconnect (default: 2 minutes) */
  warningDuration?: number
  /** Whether detection is enabled */
  enabled?: boolean
  /** Callback when user should be disconnected */
  onDisconnect?: () => void
}

interface UseIdleDetectionReturn {
  /** Whether the warning dialog should be shown */
  showWarning: boolean
  /** Seconds remaining before auto-disconnect */
  secondsRemaining: number
  /** Call this when user chooses to stay connected */
  stayConnected: () => void
  /** Call this when there's activity (audio/video) */
  reportActivity: () => void
}

export function useIdleDetection({
  idleTimeout = 10 * 60 * 1000, // 10 minutes
  warningDuration = 2 * 60 * 1000, // 2 minutes
  enabled = true,
  onDisconnect,
}: UseIdleDetectionOptions = {}): UseIdleDetectionReturn {
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  const lastActivityRef = useRef<number>(Date.now())
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const warningStartRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const startIdleTimer = useCallback(() => {
    clearTimers()

    if (!enabled) return

    idleTimerRef.current = setTimeout(() => {
      // Show warning
      setShowWarning(true)
      warningStartRef.current = Date.now()
      setSecondsRemaining(Math.ceil(warningDuration / 1000))

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - (warningStartRef.current || Date.now())
        const remaining = Math.max(0, Math.ceil((warningDuration - elapsed) / 1000))
        setSecondsRemaining(remaining)

        if (remaining <= 0) {
          clearTimers()
          setShowWarning(false)
          onDisconnect?.()
        }
      }, 1000)
    }, idleTimeout)
  }, [enabled, idleTimeout, warningDuration, onDisconnect, clearTimers])

  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now()

    // If warning is showing, don't reset (user must click "Stay connected")
    if (!showWarning) {
      startIdleTimer()
    }
  }, [showWarning, startIdleTimer])

  const stayConnected = useCallback(() => {
    clearTimers()
    setShowWarning(false)
    warningStartRef.current = null
    lastActivityRef.current = Date.now()
    startIdleTimer()
  }, [clearTimers, startIdleTimer])

  // Start timer on mount
  useEffect(() => {
    if (enabled) {
      startIdleTimer()
    }

    return () => {
      clearTimers()
    }
  }, [enabled, startIdleTimer, clearTimers])

  return {
    showWarning,
    secondsRemaining,
    stayConnected,
    reportActivity,
  }
}
