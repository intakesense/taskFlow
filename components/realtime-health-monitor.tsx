'use client'

import { useEffect, useState } from 'react'
import { realtimeManager } from '@/lib/realtime-manager'

/**
 * Realtime Health Monitor
 * Monitors channel health and provides emergency recovery
 * Only shown in development mode
 */
export function RealtimeHealthMonitor() {
  const [showMonitor, setShowMonitor] = useState(false)
  const [health, setHealth] = useState<ReturnType<typeof realtimeManager.getHealthStatus> | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    // Show monitor with Ctrl+Shift+R
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        setShowMonitor((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    // Health check every 5 seconds
    const interval = setInterval(() => {
      const status = realtimeManager.getHealthStatus()
      setHealth(status)

      // Auto-warn if unhealthy
      if (!status.isHealthy) {
        console.warn('🚨 REALTIME HEALTH WARNING:', status)
      }
    }, 5000)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      clearInterval(interval)
    }
  }, [])

  if (!showMonitor || process.env.NODE_ENV !== 'development') return null

  const handleEmergencyCleanup = () => {
    if (confirm('Emergency cleanup: Remove ALL realtime channels?')) {
      realtimeManager.cleanup()
      alert('All channels cleaned up. Refresh the page.')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: health?.isHealthy ? '#10b981' : '#ef4444',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 9999,
        maxWidth: '300px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        🔌 Realtime Health Monitor
      </div>

      {health && (
        <>
          <div>
            Channels: {health.totalChannels}/{health.maxChannels}
          </div>
          <div>Configured: {health.configuredChannels}</div>
          <div>Status: {health.isHealthy ? '✅ Healthy' : '⚠️ Warning'}</div>

          {health.warnings.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              <strong>Warnings:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {health.warnings.map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '8px' }}>
            <button
              onClick={handleEmergencyCleanup}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              🚨 Emergency Cleanup
            </button>
          </div>

          <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.8 }}>
            Press Ctrl+Shift+R to toggle
          </div>
        </>
      )}
    </div>
  )
}
