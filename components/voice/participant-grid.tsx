'use client'

import { useState, useCallback } from 'react'
import { ParticipantTile } from './participant-tile'
import { cn } from '@/lib/utils'
import { useBreakpoints } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { X, Minimize2 } from 'lucide-react'

interface ParticipantGridProps {
  participantIds: string[]
  localSessionId: string | null
}

export function ParticipantGrid({ participantIds, localSessionId }: ParticipantGridProps) {
  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handlePin = useCallback((sessionId: string) => {
    setPinnedSessionId(sessionId)
  }, [])

  const handleUnpin = useCallback(() => {
    setPinnedSessionId(null)
    setIsFullscreen(false)
  }, [])

  const handleFullscreen = useCallback((sessionId: string) => {
    setPinnedSessionId(sessionId)
    setIsFullscreen(true)
  }, [])

  const handleExitFullscreen = useCallback(() => {
    setIsFullscreen(false)
  }, [])

  const sortedIds = [...participantIds].sort((a, b) => {
    if (a === localSessionId) return -1
    if (b === localSessionId) return 1
    return 0
  })

  const count = sortedIds.length

  // Reset pinned participant if they leave
  if (pinnedSessionId && !participantIds.includes(pinnedSessionId)) {
    setPinnedSessionId(null)
    setIsFullscreen(false)
  }

  if (count === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Waiting for participants...</p>
      </div>
    )
  }

  // Fullscreen view - show only the pinned participant
  if (isFullscreen && pinnedSessionId) {
    return (
      <div className="relative h-full w-full p-2">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={handleExitFullscreen}
          >
            <Minimize2 className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={handleUnpin}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ParticipantTile
          sessionId={pinnedSessionId}
          isLocal={pinnedSessionId === localSessionId}
          isMobile={isSmallScreen}
          isPinned={true}
          isFullscreen={true}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onFullscreen={handleFullscreen}
        />
      </div>
    )
  }

  // Pinned view with spotlight - show pinned participant large, others in strip
  if (pinnedSessionId) {
    const otherIds = sortedIds.filter(id => id !== pinnedSessionId)

    return (
      <div className={cn(
        'flex h-full w-full gap-2 p-2',
        isSmallScreen ? 'flex-col' : 'flex-row'
      )}>
        {/* Main pinned participant */}
        <div className={cn(
          'relative',
          isSmallScreen ? 'flex-1 min-h-0' : 'flex-1'
        )}>
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
              onClick={handleUnpin}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ParticipantTile
            sessionId={pinnedSessionId}
            isLocal={pinnedSessionId === localSessionId}
            isMobile={isSmallScreen}
            isPinned={true}
            onPin={handlePin}
            onUnpin={handleUnpin}
            onFullscreen={handleFullscreen}
          />
        </div>

        {/* Other participants strip */}
        {otherIds.length > 0 && (
          <div className={cn(
            'flex gap-2 overflow-auto',
            isSmallScreen
              ? 'flex-row h-24 flex-shrink-0'
              : 'flex-col w-48 flex-shrink-0'
          )}>
            {otherIds.map((id) => (
              <div
                key={id}
                className={cn(
                  'flex-shrink-0',
                  isSmallScreen ? 'w-32 h-full' : 'w-full h-36'
                )}
              >
                <ParticipantTile
                  sessionId={id}
                  isLocal={id === localSessionId}
                  isMobile={isSmallScreen}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onFullscreen={handleFullscreen}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Calculate optimal grid layout based on participant count and screen size
  const getGridLayout = () => {
    if (isSmallScreen) {
      // Mobile/Tablet: Portrait-oriented layouts
      if (count === 1) return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' }
      if (count === 2) return { cols: 1, rows: 2, className: 'grid-cols-1 grid-rows-2' }
      if (count <= 4) return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' }
      if (count <= 6) return { cols: 2, rows: 3, className: 'grid-cols-2 grid-rows-3' }
      return { cols: 2, rows: Math.ceil(count / 2), className: 'grid-cols-2' }
    }

    // Desktop: Landscape-oriented layouts
    if (count === 1) return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' }
    if (count === 2) return { cols: 2, rows: 1, className: 'grid-cols-2 grid-rows-1' }
    if (count === 3) return { cols: 3, rows: 1, className: 'grid-cols-3 grid-rows-1' }
    if (count === 4) return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' }
    if (count <= 6) return { cols: 3, rows: 2, className: 'grid-cols-3 grid-rows-2' }
    if (count <= 9) return { cols: 3, rows: 3, className: 'grid-cols-3 grid-rows-3' }
    if (count <= 12) return { cols: 4, rows: 3, className: 'grid-cols-4 grid-rows-3' }
    return { cols: 4, rows: Math.ceil(count / 4), className: 'grid-cols-4' }
  }

  const layout = getGridLayout()

  return (
    <div
      className={cn(
        'grid h-full w-full gap-2 p-2',
        layout.className
      )}
    >
      {sortedIds.map((id) => (
        <ParticipantTile
          key={id}
          sessionId={id}
          isLocal={id === localSessionId}
          isMobile={isSmallScreen}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onFullscreen={handleFullscreen}
        />
      ))}
    </div>
  )
}
